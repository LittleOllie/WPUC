import { useEffect } from "react";
import RzAmbientStage from "../components/RzAmbientStage";
import WhitelistCheckerForm from "../features/whitelist/components/WhitelistCheckerForm";

export default function WhitelistCheckerPage() {
  useEffect(() => {
    document.title = "Check Your Whitelist — Blackwater Labs";
  }, []);

  return (
    <RzAmbientStage>
      <section className="wl-page">
        <header className="wl-page__header">
          <p className="wl-page__eyebrow">BLACKWATER LABS</p>
          <h1 className="wl-page__title">Check Your Whitelist</h1>
          <p className="wl-page__lead">
            Enter the EVM wallet address you submitted for whitelist consideration.
            We will check whether it appears on the list and show its confirmation status.
          </p>
        </header>
        <WhitelistCheckerForm />
      </section>
    </RzAmbientStage>
  );
}
