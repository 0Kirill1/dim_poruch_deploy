package dimporuchbe.reviews.api.dtos;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import io.swagger.v3.oas.annotations.media.Schema;

import java.util.UUID;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Schema(description = "Aggregated rating for a listing")
public class ListingRatingDto {
    private UUID listingId;
    private Double averageRating;
    private Long reviewCount;
}
