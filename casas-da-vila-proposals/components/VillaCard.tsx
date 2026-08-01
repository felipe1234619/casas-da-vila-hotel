import Image from "next/image";

type VillaCardProps = {
  name: string;
  description: string;
  nightlyRate: number;
  image: string;
  featured?: boolean;
};

export default function VillaCard({
  name,
  description,
  nightlyRate,
  image,
  featured = false,
}: VillaCardProps) {
  return (
    <article className={`villa-card ${featured ? "villa-card-featured" : ""}`}>
      <div className="villa-image-wrapper">
        <Image
          src={image}
          alt={name}
          fill
          sizes={
            featured
              ? "(max-width: 900px) 100vw, 58vw"
              : "(max-width: 900px) 100vw, 42vw"
          }
          className="villa-image"
        />

        <div className="villa-image-overlay" />

        {featured ? (
          <span className="villa-featured-label">
            Private pool residence
          </span>
        ) : null}
      </div>

      <div className="villa-card-content">
        <div>
          <p className="villa-type">
            {featured ? "Two-bedroom villa" : "Private one-suite villa"}
          </p>

          <h3>{name}</h3>

          <p className="body-copy">{description}</p>
        </div>

        <div className="villa-rate">
          <span>From</span>
          <strong>
            £{nightlyRate.toLocaleString("en-GB")}
          </strong>
          <span>per villa, per night</span>
        </div>
      </div>
    </article>
  );
}