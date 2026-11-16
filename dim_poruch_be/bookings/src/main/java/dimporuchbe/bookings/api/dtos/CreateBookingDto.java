package dimporuchbe.bookings.api.dtos;

import jakarta.validation.constraints.NotNull;
import lombok.Data;
import io.swagger.v3.oas.annotations.media.Schema;

import java.time.LocalDate;
import java.util.UUID;

@Data
@Schema(description = "Data required to create a booking")
public class CreateBookingDto {
    @NotNull(message = "Listing cannot be null")
    private UUID listing;

    @NotNull(message = "Set start date")
    private LocalDate startDate;

    @NotNull(message = "Set end date")
    private LocalDate endDate;

    private String message;
}
