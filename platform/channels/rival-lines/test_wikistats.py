import unittest
import wikistats

TABLE = """<table><tr><th>Club</th><th>Season</th></tr>
<tr><td>Barcelona</td><td>2004–05[3]</td><td>La Liga</td><td>7</td><td>1</td><td>1</td><td>0</td><td>1</td><td>0</td><td>—</td><td>9</td><td>1</td></tr>
<tr><td>2011–12[10]</td><td>La Liga</td><td>37</td><td>50</td><td>7</td><td>3</td><td>11</td><td>14</td><td>5[f]</td><td>6</td><td>60</td><td>73</td></tr>
<tr><td>Total</td><td>44</td><td>51</td></tr>
<tr><td>Barcelona B</td><td>2003–04[2]</td><td>Segunda División B</td><td>5</td><td>0</td><td>5</td><td>0</td></tr></table>"""


class WikiStatsTests(unittest.TestCase):
    def test_parses_only_barcelona_la_liga_season_rows(self):
        rows = wikistats.parse_seasons(TABLE)
        self.assertEqual([r["season"] for r in rows], ["2004-05", "2011-12"])
        self.assertEqual((rows[1]["league_goals"], rows[1]["goals"], rows[1]["apps"]), (50, 73, 60))
        self.assertEqual((rows[0]["league_goals"], rows[0]["goals"]), (1, 1))


if __name__ == "__main__":
    unittest.main()
