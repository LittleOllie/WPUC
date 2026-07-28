import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import PuzzleContainmentGame from "../features/containment/components/PuzzleContainmentGame";

export default function ContainmentProtocol() {
  const navigate = useNavigate();

  useEffect(() => {
    document.title = "Blackwater: Containment Protocol Z-26";
    document.documentElement.classList.add("cp-active");
    return () => {
      document.title = "☠ BlackWater Labs";
      document.documentElement.classList.remove("cp-active");
    };
  }, []);

  const handleReturn = () => {
    navigate("/");
  };

  return (
    <div className="cp-screen">
      <PuzzleContainmentGame onReturn={handleReturn} />
    </div>
  );
}
