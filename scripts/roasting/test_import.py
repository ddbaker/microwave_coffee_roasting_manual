"""Integration checks against the supplied archive plus update/recovery cases."""
from pathlib import Path
import copy
import hashlib
import json
import os
import sqlite3
import tempfile
import unittest
import zipfile
from import_logs import read_archives, generate_sql, canonical_path, PARSER_VERSION
from ods_parser import extract, normalize_book, volume

ROOT = Path(__file__).resolve().parents[2]
WORKSPACE = ROOT.parents[1]
ARCHIVE = Path(os.environ.get('ROAST_TEST_ZIP', WORKSPACE/'roasting_logs/gen_by_ddbaker/log_spreadsheet_snapshot_2026Sep14.zip'))
REFERENCE = WORKSPACE/'_com_gpt/graph/sample_ethiopia_gesha_village/sample_ethiopia_gesha_village_coffee_roast_26Jul25.ods'
KEY = '2026/ethiopia_gesha-villedge_natural_23-24crop-26Jun/coffee_roast_26Jul25.ods'

class ImportTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.files, cls.sources = read_archives([ARCHIVE])

    def database(self):
        db=sqlite3.connect(':memory:')
        db.execute('PRAGMA foreign_keys=ON')
        return db

    def apply(self, db, files=None, rebuild=False):
        sql, uid=generate_sql(self.files if files is None else files,self.sources,rebuild)
        db.executescript(sql)
        self.assertEqual(db.execute('PRAGMA integrity_check').fetchone()[0],'ok')
        self.assertEqual(db.execute('PRAGMA foreign_key_check').fetchall(),[])
        return uid

    def count(self,db):
        return db.execute('SELECT count(*) FROM roast_members JOIN roast_active USING(import_id)').fetchone()[0]

    def test_archive_coverage_and_reference(self):
        self.assertEqual(len(self.files),352)
        self.assertEqual(sum(f['profile']['graph_eligible'] for f in self.files.values()),237)
        self.assertEqual(sum(len(f['detail']['steps']) for f in self.files.values()),7846)
        self.assertTrue(all(f['profile']['roast_date'] for f in self.files.values()))
        ref,steps,_=normalize_book(KEY,extract(REFERENCE.read_bytes()))
        actual=self.files[KEY]['detail']
        fields=['duration_s','power_w','elapsed_end_s','irradiation_end_s','volume_ml','energy_kj','cumulative_irradiation_s']
        self.assertEqual(len(steps),26)
        for a,b in zip(actual['steps'],steps):
            self.assertEqual([a[k] for k in fields],[b[k] for k in fields])
        self.assertEqual([ref[k] for k in ['elapsed_seconds','heating_seconds','energy_kj','initial_volume_ml']],[1559,860,462,287.5])
        self.assertEqual([steps[9][k] for k in ['volume_ml','elapsed_end_s','cumulative_irradiation_s']],[287.5,756,470])
        self.assertEqual(steps[24]['volume_ml'],325)
        self.assertIsNone(steps[25]['volume_ml'])
        self.assertEqual(steps[25]['energy_kj'],6)

    def test_repeat_import_no_duplicate_files_or_versions(self):
        db=self.database(); self.apply(db); self.apply(db)
        self.assertEqual(self.count(db),352)
        self.assertEqual(db.execute('SELECT count(*) FROM roast_versions').fetchone()[0],352)

    def test_incremental_add_and_same_path_update(self):
        db=self.database(); self.apply(db)
        item=copy.deepcopy(self.files[KEY]); item['sha256']='a'*64
        item['version']=hashlib.sha256((KEY+'\0'+item['sha256']+'\0'+PARSER_VERSION).encode()).hexdigest()
        self.apply(db,{KEY:item})
        self.assertEqual(self.count(db),352)
        row=db.execute('SELECT version_id FROM roast_members JOIN roast_active USING(import_id) WHERE path=?',(KEY,)).fetchone()
        self.assertEqual(row[0],item['version'])
        newkey=KEY.replace('26Jul25','26Jul26')
        added=copy.deepcopy(item); added['version']='b'*64
        self.apply(db,{newkey:added})
        self.assertEqual(self.count(db),353)
        # Same directory contains both already-imported and new files.
        self.assertEqual(db.execute('SELECT count(*) FROM roast_members JOIN roast_active USING(import_id) WHERE path IN (?,?)',(KEY,newkey)).fetchone()[0],2)

    def test_rebuild_and_fresh_database(self):
        db=self.database(); self.apply(db)
        self.apply(db,{KEY:self.files[KEY]},rebuild=True)
        self.assertEqual(self.count(db),1)
        self.apply(db,rebuild=True); self.assertEqual(self.count(db),352)
        fresh=self.database(); self.apply(fresh,rebuild=True); self.assertEqual(self.count(fresh),352)

    def test_interrupted_import_keeps_old_snapshot(self):
        db=self.database(); old=self.apply(db)
        sql,_=generate_sql({KEY:self.files[KEY]},self.sources,True)
        db.executescript(sql[:sql.rfind('INSERT INTO roast_active')])
        self.assertEqual(db.execute('SELECT import_id FROM roast_active').fetchone()[0],old)
        self.assertEqual(self.count(db),352)

    def test_conflicting_duplicate_archive_paths(self):
        with tempfile.TemporaryDirectory(dir=ROOT/'.data') as temp:
            a=Path(temp)/'a.zip'; b=Path(temp)/'b.zip'
            blob=REFERENCE.read_bytes()
            with zipfile.ZipFile(a,'w') as z:z.writestr('logs/'+KEY,blob)
            with zipfile.ZipFile(b,'w') as z:z.writestr('other/'+KEY,blob+b'changed')
            with self.assertRaisesRegex(ValueError,'Conflicting versions'):read_archives([a,b])
            files,_=read_archives([a,a]); self.assertEqual(len(files),1)

    def test_paths_and_conversions(self):
        self.assertEqual(canonical_path('logs/'+KEY),KEY)
        self.assertEqual(canonical_path(KEY.replace('/','\\')),KEY)
        for invalid in ['../'+KEY,'/logs/'+KEY,'2026/a/sub/file.ods','file.ods']:
            with self.assertRaises(ValueError):canonical_path(invalid)
        self.assertEqual(volume('275/300')[0],287.5)
        self.assertEqual(volume('275+')[0],280)
        self.assertEqual(volume('275-')[0],270)
        self.assertIsNone(volume('235')[0])

if __name__=='__main__':
    (ROOT/'.data').mkdir(exist_ok=True)
    unittest.main(verbosity=2)
