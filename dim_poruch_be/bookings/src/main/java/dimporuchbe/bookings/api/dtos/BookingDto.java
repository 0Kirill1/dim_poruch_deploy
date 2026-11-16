package dimporuchbe.bookings.api.dtos;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import io.swagger.v3.oas.annotations.media.Schema;

import java.time.LocalDate;
import java.util.UUID;

@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
@Schema(description = "Rental booking")
public class BookingDto {
    private UUID id;
    private UUID listing;
    private UUID tenant;
    private LocalDate startDate;
    private LocalDate endDate;
    private String status;
    private String message;
}
