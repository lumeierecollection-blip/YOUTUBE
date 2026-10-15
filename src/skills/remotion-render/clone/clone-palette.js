/**
 * clone-palette — the colours a clone shot uses, resolved from the CHANNEL, never typed into a script or a prompt (CHECK-REGISTER SCR-13).
 *
 *   accent  channels.json colors.canvas_accent (the channel's own colour, as in the canvas engine)
 *   ground  channels.json clone.ground, else the profile's ground ROLE: "paper" (warm off-white) or "mist" (cool pale grey)
 *   ink     channels.json clone.ink, else a near-black
 *   paper   the colour of type set ON an ink plate; always the light end
 *
 * The ground roles are the only colours that live here: they are what the references' grounds measured as (cream ~#F3ECDD, pale grey
 * ~#E4E4E1), named by role so a channel can override them in channels.json.
 */
const ROLES = { paper: { ground: "#F3ECDD", grid: "#D8CDB4" }, mist: { ground: "#E4E4E1", grid: "#CFCFCB" } };

export function paletteFor(profile, channel = {}) {
  const role = ROLES[profile.ground] || ROLES.paper, c = channel.clone || {};
  return {
    ground: c.ground || role.ground,
    grid: c.grid || role.grid,
    ink: c.ink || "#141414",
    paper: c.paper || "#FBF8F1",
    accent: (channel.colors && channel.colors.canvas_accent) || c.accent || "#8B1E1E",
  };
}
