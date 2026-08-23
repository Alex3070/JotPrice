import { NavLink } from "react-router-dom";
import { Camera, List, Settings } from "lucide-react";

const items = [
  { to: "/", icon: Camera, label: "记一笔" },
  { to: "/list", icon: List, label: "记录" },
  { to: "/manage", icon: Settings, label: "管理" },
];

export function BottomNav() {
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t border-orange-100 bg-white/80 backdrop-blur-xl"
      style={{ paddingBottom: "var(--safe-bottom)" }}
    >
      <div className="mx-auto flex max-w-md items-stretch justify-around px-2">
        {items.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            end={to === "/"}
            className={({ isActive }) =>
              `flex flex-1 flex-col items-center gap-1 py-2.5 text-xs transition ${
                isActive ? "text-brand-orange" : "text-muted"
              }`
            }
          >
            {({ isActive }) => (
              <>
                <Icon
                  size={22}
                  strokeWidth={isActive ? 2.4 : 1.8}
                  className={isActive ? "animate-pop" : ""}
                />
                <span className="font-medium">{label}</span>
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
