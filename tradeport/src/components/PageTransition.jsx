import { useLocation, Outlet } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";

export default function PageTransition() {
  const location = useLocation();

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={location.pathname}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -6 }}
        transition={{ duration: 0.28, ease: [0.25, 0.1, 0.25, 1] }}
        className="relative z-10"
      >
        <Outlet />
      </motion.div>
    </AnimatePresence>
  );
}
