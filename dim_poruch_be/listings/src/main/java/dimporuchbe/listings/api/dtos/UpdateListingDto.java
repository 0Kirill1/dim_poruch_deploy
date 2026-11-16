package dimporuchbe.listings.api.dtos;

import lombok.Data;
import io.swagger.v3.oas.annotations.media.Schema;

import java.math.BigDecimal;
import java.util.Set;

@Data
@Schema(description = "Optional listing fields to update")
public class UpdateListingDto {
    private String title;
    private String description;
    private String city;
    private String address;
    private BigDecimal monthlyPrice;
    private Short rooms;
    private BigDecimal area;
    private String propertyType;
    private Set<String> amenities;
}
