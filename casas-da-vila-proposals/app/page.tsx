import Link from "next/link";

export default function Home() {
  return (
    <main
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        padding: "32px",
        textAlign: "center",
      }}
    >
      <div>
        <p className="eyebrow">Casas da Vila Hotel</p>

        <h1
          style={{
            margin: 0,
            fontSize: "clamp(42px, 7vw, 84px)",
            fontWeight: 400,
            lineHeight: 1,
          }}
        >
          Private Proposal Engine
        </h1>

        <p
          className="body-copy"
          style={{
            maxWidth: "620px",
            margin: "28px auto",
          }}
        >
          Personalized accommodation proposals for private guests and special
          stays in Trancoso.
        </p>

        <Link
          href="/proposal/robert-burke"
          style={{
            display: "inline-block",
            padding: "15px 28px",
            border: "1px solid #aa8a52",
            fontFamily: "Arial, Helvetica, sans-serif",
            fontSize: "12px",
            letterSpacing: "0.16em",
            textTransform: "uppercase",
          }}
        >
          Open Robert Burke Proposal
        </Link>
      </div>
    </main>
  );
}