package dimporuchbe.listings.api.dtos;

import lombok.Data;
import io.swagger.v3.oas.annotations.media.Schema;

import java.math.BigDecimal;

@Data
@Schema(description = "Listing search filters")
public class ListingSearchDto {
    private String city;
    private BigDecimal minPrice;
    private BigDecimal maxPrice;
    private Short rooms;
    private String propertyType;
    private String amenity;
}
