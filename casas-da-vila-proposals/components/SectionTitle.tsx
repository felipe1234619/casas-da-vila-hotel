type SectionTitleProps = {
  eyebrow: string;
  title: string;
  description?: string;
  align?: "left" | "center";
};

export default function SectionTitle({
  eyebrow,
  title,
  description,
  align = "left",
}: SectionTitleProps) {
  return (
    <header
      className={`section-heading ${
        align === "center" ? "section-heading-center" : ""
      }`}
    >
      <p className="eyebrow">{eyebrow}</p>

      <h2 className="section-title">{title}</h2>

      <div
        className={`gold-line ${
          align === "center" ? "gold-line-center" : ""
        }`}
      />

      {description ? (
        <p className="body-copy section-description">{description}</p>
      ) : null}
    </header>
  );
}