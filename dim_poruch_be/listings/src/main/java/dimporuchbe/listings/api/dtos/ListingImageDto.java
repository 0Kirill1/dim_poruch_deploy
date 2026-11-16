package dimporuchbe.listings.api.dtos;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import io.swagger.v3.oas.annotations.media.Schema;

import java.time.OffsetDateTime;
import java.util.UUID;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Schema(description = "Listing image")
public class ListingImageDto {
    private UUID id;
    private UUID listingId;
    private String imageUrl;
    private Boolean isPrimary;
    private OffsetDateTime createdAt;
}
