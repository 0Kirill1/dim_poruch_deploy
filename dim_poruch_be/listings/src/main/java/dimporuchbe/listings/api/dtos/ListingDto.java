package dimporuchbe.listings.api.dtos;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import io.swagger.v3.oas.annotations.media.Schema;

import java.math.BigDecimal;
import java.util.List;
import java.util.Set;
import java.util.UUID;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Schema(description = "Property listing")
public class ListingDto {
    private UUID id;
    private String title;
    private String description;
    private String city;
    private String address;
    private BigDecimal monthlyPrice;
    private Short rooms;
    private BigDecimal area;
    private String propertyType;
    private String status;
    private UUID ownerId;
    private String primaryImageUrl;
    private List<String> imageUrls;
    private Set<String> amenities;
}
