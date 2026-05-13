import { Link, useLocation } from "react-router-dom";

export default function NavBar() {
  const { pathname } = useLocation();

  // /kindergarten (+ /kindergarten/:stage shareable links) and /brain
  // (+ subroutes) are standalone immersive experiences — no chrome.
  if (pathname === "/kindergarten" || pathname.startsWith("/kindergarten/") || pathname.startsWith("/brain")) return null;

  return (
    <header className="fixed top-0 inset-x-0 z-30 px-5 sm:px-8 py-4 flex items-center justify-between pointer-events-none">
      <Link
        to="/"
        className="pointer-events-auto group flex items-center gap-2.5 transition-opacity hover:opacity-100 opacity-90"
        aria-label="Inner Cosmos — home"
      >
        <span className="relative inline-flex items-center justify-center w-7 h-7">
          {/* Soft violet glow under the brain icon — matches the stage-1 mesh
              tint without the rainbow-halo competing with its color. */}
          <span
            className="absolute inset-0 rounded-full opacity-55 blur-[8px]"
            style={{ background: "#a87ee0" }}
          />
          <img
            src={`${import.meta.env.BASE_URL}brain-favicon.png`}
            alt=""
            className="relative w-7 h-7 object-contain pointer-events-none"
          />
        </span>
        <span className="font-display tracking-wide text-[15px] text-white/90 group-hover:text-white">
          Inner Cosmos
        </span>
      </Link>

      <nav className="pointer-events-auto flex items-center gap-1 text-sm">
        <NavLink to="/meet" current={pathname.startsWith("/meet")}>
          Meet a Neuron
        </NavLink>
        <NavLink to="/explore" current={pathname === "/explore"}>
          Explorer
        </NavLink>
        <NavLink to="/activity" current={pathname === "/activity"}>
          Activity
        </NavLink>
        {/* /explore-the-universe is hosted alongside this site at
            /inner_cosmos/explore-the-universe/ but intentionally not linked
            from the navbar — it's an unlisted side-project Amy shares
            directly. */}
      </nav>
    </header>
  );
}

function NavLink({ to, current, children }: { to: string; current: boolean; children: React.ReactNode }) {
  return (
    <Link
      to={to}
      className={`px-3.5 py-2 rounded-full transition-all duration-300 ${
        current
          ? "text-white bg-white/8 ring-1 ring-white/15"
          : "text-white/55 hover:text-white/90 hover:bg-white/5"
      }`}
    >
      {children}
    </Link>
  );
}
