package dimporuchbe.bookings.api.controllers;

import dimporuchbe.bookings.api.dtos.AvailabilityRangeDto;
import dimporuchbe.bookings.application.BookingService;
import lombok.RequiredArgsConstructor;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/listings")
@RequiredArgsConstructor
@Tag(name = "Bookings", description = "Listing availability")
public class ListingsAvailabilityController {

    private final BookingService bookingService;

    @GetMapping("/{id}/availability")
    @Operation(summary = "Get listing availability")
    public ResponseEntity<List<AvailabilityRangeDto>> getAvailability(@PathVariable UUID id) {
        return ResponseEntity.ok(bookingService.getListingAvailability(id));
    }
}
