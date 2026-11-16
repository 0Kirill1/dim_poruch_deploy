package dimporuchbe.listings.api.dtos;

import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;
import lombok.Data;
import io.swagger.v3.oas.annotations.media.Schema;

import java.math.BigDecimal;
import java.util.Set;

@Data
@Schema(description = "Data required to create a property listing")
public class CreateListingRequestDto {
    @NotBlank(message = "Title cannot be empty")
    @Size(min = 10, message = "Title is too short (10 characters at least)")
    private String title;

    @NotBlank
    private String description;

    @NotBlank
    private String city;

    @NotBlank
    private String address;

    @NotNull
    @Positive(message = "Price must be positive")
    @Digits(integer = 12, fraction = 2, message = "Wrong format")
    private BigDecimal monthlyPrice;

    @NotNull
    @Positive(message = "Number of rooms must be positive")
    private Short rooms;

    private BigDecimal area;

    @NotBlank
    private String propertyType;

    private Set<String> amenities;
}
