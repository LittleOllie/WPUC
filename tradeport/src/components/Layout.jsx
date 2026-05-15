import AmbientBackground from "./AmbientBackground";
import PageTransition from "./PageTransition";
import Navbar from "./Navbar";
import Footer from "./Footer";
import SetupProfileModal from "./SetupProfileModal";

export default function Layout() {
  return (
    <>
      <AmbientBackground />
      <Navbar />
      <main className="relative z-10 flex-1">
        <PageTransition />
      </main>
      <Footer />
      <SetupProfileModal />
    </>
  );
}
