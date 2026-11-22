import unittest
import sbdata


def ev(type_, team, player, minute=1, period=1, loc=(60, 40), **extra):
    e = {"type": {"name": type_}, "team": {"name": team}, "player": {"name": player}, "minute": minute, "second": 0, "period": period, "location": list(loc)}
    e.update(extra)
    return e


class SbDataTests(unittest.TestCase):
    def test_every_position_id_has_coordinates_inside_the_pitch(self):
        for pid, (x, y) in sbdata.POSITION_XY.items():
            self.assertTrue(0 <= x <= 120 and 0 <= y <= 80, pid)
        self.assertEqual(set(sbdata.POSITION_XY), set(range(1, 26)))

    def test_goalkeeper_is_deepest_and_centre_forward_is_highest(self):
        xs = {pid: xy[0] for pid, xy in sbdata.POSITION_XY.items()}
        self.assertEqual(min(xs, key=xs.get), 1)
        self.assertGreaterEqual(xs[23], max(xs[p] for p in range(1, 22)))

    def test_passing_network_counts_only_completed_passes_in_window(self):
        a = lambda m, who, to, ok=True, loc=(50, 40): ev("Pass", "T", who, m, loc=loc, **{"pass": ({"recipient": {"name": to}} if ok else {"recipient": {"name": to}, "outcome": {"name": "Incomplete"}})})
        events = [a(1, "A", "B"), a(2, "B", "A"), a(3, "A", "B"), a(4, "A", "B", ok=False), a(41, "A", "B"), a(5, "A", "C")]
        net = sbdata.passing_network(events, "T", until_minute=40, min_pair=3)
        self.assertEqual(net["completed"], 4)
        self.assertEqual([(e["a"], e["b"], e["count"]) for e in net["edges"]], [("A", "B", 3)])
        self.assertEqual(net["nodes"]["A"]["count"], 3)

    def test_shots_exclude_the_shootout_by_default(self):
        s = lambda minute, period, xg, out="Goal": ev("Shot", "T", "A", minute, period, shot={"statsbomb_xg": xg, "outcome": {"name": out}})
        events = [s(10, 1, 0.5), s(120, 4, 0.1), s(121, 5, 0.78)]
        self.assertEqual(len(sbdata.shots(events)), 2)
        self.assertEqual(len(sbdata.shots(events, include_shootout=True)), 3)
        self.assertEqual(len(sbdata.shots(events, until_minute=79)), 1)

    def test_cumulative_xg_is_monotone_and_ends_at_the_total(self):
        sl = [{"team": "T", "minute": 10, "second": 0, "xg": 0.3}, {"team": "T", "minute": 40, "second": 0, "xg": 0.2}, {"team": "U", "minute": 5, "second": 0, "xg": 0.9}]
        pts = sbdata.cumulative_xg(sl, "T")
        ys = [p[1] for p in pts]
        self.assertEqual(ys, sorted(ys))
        self.assertAlmostEqual(ys[-1], 0.5)

    def test_display_names_keep_surname_particles(self):
        self.assertEqual(sbdata.compress_name("Lionel Messi"), "Messi")
        self.assertEqual(sbdata.compress_name("Alexis Mac Allister"), "Mac Allister")
        self.assertEqual(sbdata.compress_name("Rodrigo De Paul"), "De Paul")
        self.assertEqual(sbdata.compress_name("Hugo Lloris"), "Lloris")
        self.assertEqual(sbdata.compress_name("Neymar"), "Neymar")
        names = sbdata.display_names([{"lineup": [{"player_name": "Lionel Andres Messi Cuccittini", "player_nickname": "Lionel Messi"}]}])
        self.assertEqual(names["Lionel Andres Messi Cuccittini"], "Messi")


if __name__ == "__main__":
    unittest.main()
