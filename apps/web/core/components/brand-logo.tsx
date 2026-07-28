import Image from "next/image";

type BrandLogoProps = {
  className?: string;
  priority?: boolean;
};

export function BrandLogo({ className, priority = false }: BrandLogoProps) {
  return (
    <Image
      alt="Movix"
      className={className}
      height={831}
      priority={priority}
      src="/movix-logo.svg"
      unoptimized
      width={1891}
    />
  );
}
