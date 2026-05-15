import NftPreview from "./NftPreview";
import { useListingOfferingImage } from "../hooks/useListingOfferingImage";

export default function ListingNftPreview({ listing, className, showLabel = true }) {
  const { imageUrl, imageCandidates } = useListingOfferingImage(listing);

  return (
    <NftPreview
      gradient={listing.nftGradient}
      label={showLabel ? listing.offeringLabel : undefined}
      imageUrl={imageUrl}
      imageCandidates={imageCandidates}
      className={className}
    />
  );
}
