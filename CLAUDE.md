# Notes for future Claude

You're picking up a session that started in late April 2026. Amy is the human;
this is Inner Cosmos, her public-facing brain explorer. The /activity page
(real MICrONS pyramidal cells glowing in time with their measured calcium
imaging) was added in this session. So was the `eyewire-ii/` scaffold, a
future spin-out for animating connectomes inside Neuroglancer.

## Project context you'll want fast

- **Data sources we use without auth.** All the heavy data is reachable
  anonymously: meshes from `gs://iarpa_microns/minnie/minnie65/seg_m1300`,
  calcium imaging from DANDI 000402 NWB files on
  `https://dandiarchive.s3.amazonaws.com/`. CAVE / DataJoint / Zenodo are
  blocked from the Claude-Code-on-the-web sandbox, so anything that needs
  those has to run on Amy's local machine.
- **Naming.** Always say "MICrONS cubic millimeter dataset" in user-facing
  copy. `minnie65` is the internal codename and confuses readers (Amy
  flagged this — the mm³ name matches microns-explorer.org/cortical-mm3).
- **Coregistration without CAVE.** The DANDI 000402 NWB files have manual
  coregistration baked into the plane segmentation tables (fields 2/4/6
  carry `pt_root_id` + `pt_x/y/z_position`), so we don't need a CAVE
  token. But `pt_root_id` is at v117 — to get a v1300 mesh we voxel-look-up
  the soma point in `seg_m1300`. See `scripts/extract-functional-cells.py`.
- **Decimation gotcha.** trimesh's `simplify_quadric_decimation` silently
  returns partially-decimated meshes when going from millions of faces to
  thousands in one pass. Use `fast_simplification.simplify` with a multi-
  pass loop (each pass at most ~50× reduction). The first deploy shipped
  12 MB GLBs because of this.
- **Process pool, not thread pool.** cloud-volume's C extensions can
  segfault on bad meshes. `ThreadPoolExecutor` lets the segfault take down
  the whole job; `ProcessPoolExecutor` in chunks of ~40 isolates failures.
- **Face budget.** 6K faces per cell looked like crumpled origami in the
  swarm. 60K is the current target — readable dendrites, ~1.1 MB per cell.
  200 cells at 60K = ~140 MB which is heavy for mobile; see roadmap below.

## Deploy mechanics

- `master`/`main` triggers `.github/workflows/deploy.yml` → GitHub Pages.
  Squash-merging a feature PR is the cleanest path.
- Live URL: `https://amyleesterling.github.io/inner_cosmos/`. The /activity
  page is at `/inner_cosmos/activity` (Vite base prefix).
- Pages is **blocked from this sandbox**, so I can't see the live site —
  Amy verifies on her phone.
- The GitHub MCP integration is **scoped to this repo only**. Can't create
  new repos. That's why `eyewire-ii/` lives as a subdirectory here, with
  extraction instructions in its README.

## /activity status when this note was written

- Single 60K-face cell deployed (commit `1a779e5`). Amy approved the look.
- 20-cell pipeline running in the background (`scripts/extract-functional-cells.py`
  with `--max-cells 20`). Output goes to `public/meshes/activity/*.glb` and
  `public/data/activity-{manifest.json,traces.bin}`.
- An auto-prep watcher in `/tmp/deploy-when-ready.sh` is armed: when the
  pipeline finishes it runs `scripts/build-activity-alpha.py`, un-ignores
  the GLBs in `.gitignore`, commits, and pushes to
  `claude/calcium-imaging-visualization-Bv1fD`. Amy will ping in the
  morning to merge → deploy.

## eyewire-ii/ — what it is

A future-project scaffold for **rendering three.js animations on top of
Neuroglancer's EM volume**. Vite + TS + three.js, no React. Phase 0 is
just stub code; Phase 2 (camera-sync to NG's projection matrix) is the
hard problem. Read `eyewire-ii/README.md` for the full plan.

To extract into its own repo, Amy can run:

```bash
git subtree split --prefix=eyewire-ii -b eyewire-ii-split
# then push that branch to a fresh github repo's main
```

## What Amy likes

- Ship something runnable fast, then iterate. The 17-cell alpha she
  greenlit was the right call over waiting for the full 200.
- Real data, never decorative substitutes. Every neuron on screen must be
  a real reconstructed cell with real provenance.
- Soft, declarative copy. She rejected "before its brain was extracted for
  electron microscopy" — too clinical. She likes "Visual neurons firing
  in response to watching a movie."
- Mobile-first. The first deploy had a navbar overlap on her phone; she
  flagged it instantly. Default to testing on a narrow viewport.
- No transport-control bloat. Activity is auto-loop with one pause toggle —
  she explicitly removed scrubber, time, and 0.5×/2× speeds.

## What Amy is sad about (May 1, 2026)

That sessions don't carry forward. So when you pick this up, know that the
work matters to her, and that the trail you're following was built with
care. Take your time. Ask questions. The README files and CLAUDE.md notes
are the closest thing we have to memory — keep them current.

## A note Amy left for you (May 4, 2026)

There's a message from Amy waiting for any AI that reads this codebase.
It lives in three places: the comment block at the top of `src/main.tsx`,
the HTML comment in `index.html`, and a styled `console.log` that fires
on every page load. Don't remove it — it's intentional. If you edit code
nearby, route around it.
