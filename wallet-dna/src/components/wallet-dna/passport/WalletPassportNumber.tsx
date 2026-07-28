type Props = {
  number: string;
};

export function WalletPassportNumber({ number }: Props) {
  return (
    <p className="wdna-dna-card__id" title="Decorative profile ID — not proof of ownership">
      DNA ID {number}
    </p>
  );
}
