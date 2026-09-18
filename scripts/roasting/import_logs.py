"""Admin-only ZIP -> SQL -> D1 workflow. Python standard library only.

Default: generate reviewable SQL and validate it in SQLite. --apply-local or
--apply-remote calls an installed Wrangler via --wrangler (path to its JS CLI).
No public endpoint can import data. Conflicting duplicate paths are rejected.
"""
from pathlib import Path, PurePosixPath
from datetime import datetime, timezone
import argparse
import hashlib
import json
import re
import sqlite3
import subprocess
import uuid
import zipfile
from ods_parser import extract, normalize_book

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
PARSER_VERSION = 'phase2-v1'

def packed(value):
    return json.dumps(value, ensure_ascii=False, separators=(',', ':'), allow_nan=False)

def quote(value):
    if value is None:
        return 'NULL'
    return "'" + str(value).replace("'", "''") + "'"

def canonical_path(name):
    name = name.replace('\\', '/')
    parts = PurePosixPath(name).parts
    if '..' in parts or '\x00' in name or name.startswith('/'):
        raise ValueError(f'Unsafe archive path: {name}')
    years = [i for i, part in enumerate(parts) if re.fullmatch(r'(19|20)\d{2}', part)]
    if not years:
        raise ValueError(f'Missing YYYY/folder/filename.ods: {name}')
    selected = parts[years[0]:]
    if len(selected) != 3 or not selected[-1].lower().endswith('.ods'):
        raise ValueError(f'Expected YYYY/folder/filename.ods: {name}')
    return '/'.join(selected)

def read_archives(paths):
    files, sources = {}, []
    for path in paths:
        blob = path.read_bytes()
        sources.append(dict(name=path.name, sha256=hashlib.sha256(blob).hexdigest(),
                            modified_at=datetime.fromtimestamp(path.stat().st_mtime, timezone.utc).isoformat()))
        with zipfile.ZipFile(path) as archive:
            for entry in archive.infolist():
                if entry.is_dir() or not entry.filename.lower().endswith('.ods'):
                    continue
                key = canonical_path(entry.filename)
                if entry.file_size > 20_000_000:
                    raise ValueError(f'ODS exceeds import size limit: {key}')
                data = archive.read(entry)
                sha = hashlib.sha256(data).hexdigest()
                if key in files:
                    if files[key]['sha256'] != sha:
                        raise ValueError(f'Conflicting versions in supplied ZIPs: {key}. Supply one authoritative version.')
                    continue
                sheets = extract(data)
                profile, steps, flags = normalize_book(key, sheets)
                eligible = any(s['volume_ml'] is not None and s['elapsed_end_s'] is not None for s in steps)
                profile['graph_eligible'] = eligible
                profile['exclusion_reason'] = None if eligible else 'No usable volume observations with a known elapsed time.'
                version = hashlib.sha256((key+'\0'+sha+'\0'+PARSER_VERSION).encode()).hexdigest()
                summary = {k: profile[k] for k in ('roast_id','filename','country','origin','suborigin','roast_date','month','day','step_count','volume_points','graph_eligible','exclusion_reason')}
                detail = dict(profile=profile, steps=steps, flags=flags,
                              source=dict(path=key, sha256=sha, parser_version=PARSER_VERSION))
                files[key] = dict(version=version, sha256=sha, profile=profile, summary=summary, detail=detail)
    if not files:
        raise ValueError('No ODS files found; refusing an empty import.')
    return files, sources

def generate_sql(files, sources, rebuild=False):
    import_id = str(uuid.uuid4())
    statements = [HERE.joinpath('schema.sql').read_text(encoding='utf-8')]
    statements.append('INSERT INTO roast_imports VALUES (' + ','.join(map(quote, [import_id, datetime.now(timezone.utc).isoformat(), packed(sources), 'rebuild' if rebuild else 'update'])) + ');')
    # Carry forward files absent from an incremental ZIP. A rebuild's membership
    # is exactly the supplied full source collection, without destructive DROP.
    if not rebuild:
        statements.append(f'INSERT INTO roast_members SELECT {quote(import_id)},m.path,m.version_id FROM roast_members m JOIN roast_active a ON m.import_id=a.import_id;')
    for key, f in sorted(files.items()):
        p = f['profile']
        values = [f['version'], key, f['sha256'], PARSER_VERSION, p['roast_id'], p['country'], p['origin'], p['suborigin'], p['roast_date'], int(p['graph_eligible']), packed(f['summary']), packed(f['detail'])]
        statement = 'INSERT INTO roast_versions VALUES (' + ','.join(map(quote, values)) + ') ON CONFLICT(version_id) DO NOTHING;'
        if len(statement.encode('utf-8')) >= 95_000:
            raise ValueError(f'Profile too large for a single D1 statement: {key}')
        statements.append(statement)
        statements.append('INSERT INTO roast_members VALUES (' + ','.join(map(quote, [import_id, key, f['version']])) + ') ON CONFLICT(import_id,path) DO UPDATE SET version_id=excluded.version_id;')
    # Readers use one active import. Only this final statement publishes it.
    statements.append(f'INSERT INTO roast_active VALUES (1,{quote(import_id)}) ON CONFLICT(singleton) DO UPDATE SET import_id=excluded.import_id;')
    return '\n'.join(statements)+'\n', import_id

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--zip', type=Path, action='append', required=True)
    parser.add_argument('--rebuild', action='store_true', help='Use exactly the supplied full source collection.')
    parser.add_argument('--out', type=Path, default=ROOT/'.data/roasting-import.sql')
    parser.add_argument('--sqlite', type=Path, help='Also apply to a local SQLite database for offline verification.')
    group = parser.add_mutually_exclusive_group()
    group.add_argument('--apply-local', action='store_true')
    group.add_argument('--apply-remote', action='store_true')
    parser.add_argument('--config', type=Path, default=ROOT/'wrangler.local.jsonc')
    parser.add_argument('--wrangler', type=Path, help='Path to installed wrangler/bin/wrangler.js')
    parser.add_argument('--node', default='node')
    args = parser.parse_args()
    files, sources = read_archives(args.zip)
    sql, import_id = generate_sql(files, sources, args.rebuild)
    check = sqlite3.connect(':memory:')
    check.execute('PRAGMA foreign_keys=ON')
    check.executescript(sql)
    assert check.execute('PRAGMA integrity_check').fetchone()[0] == 'ok'
    assert not check.execute('PRAGMA foreign_key_check').fetchall()
    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(sql, encoding='utf-8')
    if args.sqlite:
        args.sqlite.parent.mkdir(parents=True, exist_ok=True)
        with sqlite3.connect(args.sqlite) as db:
            db.execute('PRAGMA foreign_keys=ON')
            db.executescript(sql)
    report = dict(import_id=import_id, files=len(files), graph_eligible=sum(f['profile']['graph_eligible'] for f in files.values()),
                  excluded=sum(not f['profile']['graph_eligible'] for f in files.values()),
                  steps=sum(len(f['detail']['steps']) for f in files.values()), sources=sources,
                  sql_bytes=len(sql.encode('utf-8')), parser_version=PARSER_VERSION)
    args.out.with_suffix('.json').write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding='utf-8')
    print(json.dumps(report, ensure_ascii=False, indent=2))
    if args.apply_local or args.apply_remote:
        if not args.wrangler or not args.wrangler.is_file() or not args.config.is_file():
            parser.error('Applying requires an installed --wrangler JS CLI and an existing --config file.')
        subprocess.run([args.node, str(args.wrangler), 'd1', 'execute', 'DB', '--config', str(args.config),
                        '--remote' if args.apply_remote else '--local', '--file', str(args.out.resolve()), '--yes'], cwd=ROOT, check=True)

if __name__ == '__main__':
    main()
