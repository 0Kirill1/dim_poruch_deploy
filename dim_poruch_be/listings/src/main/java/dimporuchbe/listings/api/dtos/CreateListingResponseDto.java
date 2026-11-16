package dimporuchbe.listings.api.dtos;

import lombok.Builder;
import lombok.Getter;
import io.swagger.v3.oas.annotations.media.Schema;

import java.util.UUID;

@Builder
@Getter
@Schema(description = "Result of listing creation")
public class CreateListingResponseDto {
    private UUID listingId;
    private String message;
}
