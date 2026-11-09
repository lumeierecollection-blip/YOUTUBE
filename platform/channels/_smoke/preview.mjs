// Proves the preview pipeline end to end before channel agents depend on it.
export default async function preview({ tools }) {
  const video = tools.renderComposition({ id: "ChannelSmoke", props: { label: "Pipeline check" } });
  tools.stage("render_complete", "running");
  await tools.contactSheet({ video, scenes: [{ id: "s0", start_s: 0, end_s: 2, treatment: "smoke", objective: "Confirms composition registration and rendering" }] });
  tools.voice({ text: "Preview pipeline check.", voice: "en-US-AndrewNeural" });
  tools.write("qa-report.json", { duration_s: tools.durationOf(video) });
}
