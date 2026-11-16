package dimporuchbe.bookings.api.controllers;

import dimporuchbe.bookings.api.dtos.BookingDto;
import dimporuchbe.bookings.api.dtos.CreateBookingDto;
import dimporuchbe.bookings.api.dtos.CreateBookingResponseDto;
import dimporuchbe.bookings.application.BookingService;
import dimporuchbe.bookings.persistence.BookingStatus;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/bookings")
@RequiredArgsConstructor
@Tag(name = "Bookings", description = "Rental booking lifecycle operations")
@SecurityRequirement(name = "bearerAuth")
public class BookingController {
    private final BookingService bookingService;

    @PostMapping
    @Operation(summary = "Create a booking")
    public ResponseEntity<CreateBookingResponseDto> createBooking(@RequestBody @Valid CreateBookingDto dto,
                                                                  @AuthenticationPrincipal UserDetails userDetails){
        String email = userDetails.getUsername();
        CreateBookingResponseDto result = bookingService.createBooking(dto, email);
        return ResponseEntity.status(HttpStatus.CREATED).body(result);
    }

    @GetMapping
    @Operation(summary = "List my bookings")
    public ResponseEntity<List<BookingDto>> getUserBookings(@AuthenticationPrincipal UserDetails userDetails){
        String email = userDetails.getUsername();
        List<BookingDto> result = bookingService.getBookings(email);
        return ResponseEntity.ok(result);
    }

    @PreAuthorize("hasRole('LANDLORD')")
    @GetMapping("/landlord")
    @Operation(summary = "List landlord bookings")
    public ResponseEntity<Page<BookingDto>> getLandlordBookings(@RequestParam(required = false) BookingStatus status,
                                                                @AuthenticationPrincipal UserDetails userDetails,
                                                                Pageable pageable){
        String email = userDetails.getUsername();
        Page<BookingDto> result = bookingService.getLandlordBookings(email, status, pageable);
        return ResponseEntity.ok(result);
    }

    @PreAuthorize("hasRole('LANDLORD')")
    @PostMapping("/{id}/confirm")
    @Operation(summary = "Confirm a booking")
    public ResponseEntity<BookingDto> confirmBooking(@PathVariable UUID id,
                                                     @AuthenticationPrincipal UserDetails userDetails){
        String email = userDetails.getUsername();
        BookingDto result = bookingService.updateStatus(id, BookingStatus.APPROVED, email);
        return ResponseEntity.ok(result);
    }

    @PreAuthorize("hasRole('LANDLORD')")
    @PostMapping("/{id}/reject")
    @Operation(summary = "Reject a booking")
    public ResponseEntity<BookingDto> rejectBooking(@PathVariable UUID id,
                                                    @AuthenticationPrincipal UserDetails userDetails){
        String email = userDetails.getUsername();
        BookingDto result = bookingService.updateStatus(id, BookingStatus.REJECTED, email);
        return ResponseEntity.ok(result);
    }

    @PostMapping("/{id}/cancel")
    @Operation(summary = "Cancel a booking")
    public ResponseEntity<BookingDto> cancelBooking(@PathVariable UUID id,
                                                    @AuthenticationPrincipal UserDetails userDetails){
        String email = userDetails.getUsername();
        BookingDto result = bookingService.updateStatus(id, BookingStatus.CANCELLED, email);
        return ResponseEntity.ok(result);
    }

    @PostMapping("/{id}/complete")
    @Operation(summary = "Complete a booking")
    public ResponseEntity<BookingDto> completeBooking(@PathVariable UUID id,
                                                      @AuthenticationPrincipal UserDetails userDetails){
        String email = userDetails.getUsername();
        BookingDto result = bookingService.updateStatus(id, BookingStatus.COMPLETED, email);
        return ResponseEntity.ok(result);
    }
}
