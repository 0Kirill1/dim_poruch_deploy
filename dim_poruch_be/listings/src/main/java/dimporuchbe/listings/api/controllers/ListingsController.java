package dimporuchbe.listings.api.controllers;

import dimporuchbe.listings.api.dtos.CreateListingRequestDto;
import dimporuchbe.listings.api.dtos.CreateListingResponseDto;
import dimporuchbe.listings.api.dtos.ListingDto;
import dimporuchbe.listings.api.dtos.ListingImageDto;
import dimporuchbe.listings.api.dtos.ListingSearchDto;
import dimporuchbe.listings.api.dtos.UpdateListingDto;
import dimporuchbe.listings.application.ListingService;
import dimporuchbe.listings.persistence.Status;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.core.io.Resource;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.ModelAttribute;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequiredArgsConstructor
@RequestMapping("/listings")
@Tag(name = "Listings", description = "Property listing management and search")
public class ListingsController {
    private final ListingService listingService;

    @PreAuthorize("hasRole('LANDLORD')")
    @PostMapping
    @Operation(summary = "Create a listing")
    @ApiResponses({@ApiResponse(responseCode = "201", description = "Listing created"),
            @ApiResponse(responseCode = "400", description = "Invalid listing data")})
    @SecurityRequirement(name = "bearerAuth")
    public ResponseEntity<CreateListingResponseDto> createListing(@RequestBody @Valid CreateListingRequestDto dto,
                                                                  @AuthenticationPrincipal UserDetails userDetails){
        CreateListingResponseDto response = listingService.createListing(dto, userDetails.getUsername());
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    @GetMapping("/{id}")
    @Operation(summary = "Get a listing by ID")
    @ApiResponse(responseCode = "200", description = "Listing returned")
    public ResponseEntity<ListingDto> findListingById(@PathVariable UUID id){
        ListingDto result = listingService.findListingById(id);
        return ResponseEntity.ok(result);
    }

    @PreAuthorize("hasRole('LANDLORD')")
    @GetMapping("/my")
    @Operation(summary = "List my listings")
    @SecurityRequirement(name = "bearerAuth")
    public ResponseEntity<Page<ListingDto>> getMyListings(@AuthenticationPrincipal UserDetails userDetails,
                                                          Pageable pageable){
        Page<ListingDto> result = listingService.getMyListings(userDetails.getUsername(), pageable);
        return ResponseEntity.ok(result);
    }

    @PatchMapping("/{id}")
    @Operation(summary = "Update a listing")
    @SecurityRequirement(name = "bearerAuth")
    public ResponseEntity<ListingDto> updateListing(@PathVariable UUID id,
                                                    @RequestBody UpdateListingDto dto,
                                                    @AuthenticationPrincipal UserDetails userDetails){
        ListingDto result = listingService.updateListing(id, dto, userDetails.getUsername());
        return ResponseEntity.ok().body(result);
    }

    @PreAuthorize("hasRole('LANDLORD')")
    @PatchMapping("/{id}/status")
    @Operation(summary = "Update listing status")
    @SecurityRequirement(name = "bearerAuth")
    public ResponseEntity<ListingDto> updateListingStatus(@PathVariable UUID id,
                                                          @RequestParam Status status,
                                                          @AuthenticationPrincipal UserDetails userDetails){
        ListingDto result = listingService.updateListingStatus(id, status, userDetails.getUsername());
        return ResponseEntity.ok(result);
    }

    @PreAuthorize("hasRole('LANDLORD')")
    @DeleteMapping("/{id}")
    @Operation(summary = "Archive a listing")
    @SecurityRequirement(name = "bearerAuth")
    public ResponseEntity<Map<String, String>> deleteListing(@PathVariable UUID id,
                                                             @AuthenticationPrincipal UserDetails userDetails){
        listingService.deleteListing(id, userDetails.getUsername());
        return ResponseEntity.ok(Map.of("message", "Оголошення успішно архівовано"));
    }

    @GetMapping
    @Operation(summary = "Search listings")
    public ResponseEntity<Page<ListingDto>> findListings(@ModelAttribute ListingSearchDto dto, Pageable pageable){
        Page<ListingDto> result = listingService.searchListings(dto, pageable);
        return ResponseEntity.ok(result);
    }

    @PreAuthorize("hasRole('LANDLORD')")
    @PostMapping("/{id}/images")
    @Operation(summary = "Add an image to a listing")
    @ApiResponse(responseCode = "201", description = "Image added")
    @SecurityRequirement(name = "bearerAuth")
    public ResponseEntity<ListingImageDto> addImage(@PathVariable UUID id,
                                                    @RequestParam("file") MultipartFile file,
                                                    @RequestParam(value = "isPrimary", required = false) Boolean isPrimary,
                                                    @AuthenticationPrincipal UserDetails userDetails){
        ListingImageDto result = listingService.addImage(id, file, isPrimary, userDetails.getUsername());
        return ResponseEntity.status(HttpStatus.CREATED).body(result);
    }

    @GetMapping("/{id}/images/{imageId}/content")
    @Operation(summary = "Download a listing image")
    public ResponseEntity<Resource> getImage(@PathVariable UUID id, @PathVariable UUID imageId){
        Resource image = listingService.getImage(id, imageId);
        MediaType contentType = listingService.getImageContentType(id, imageId);
        return ResponseEntity.ok().contentType(contentType).body(image);
    }

    @GetMapping("/{id}/images")
    @Operation(summary = "List listing images")
    public ResponseEntity<List<ListingImageDto>> getImages(@PathVariable UUID id){
        List<ListingImageDto> result = listingService.getListingImages(id);
        return ResponseEntity.ok(result);
    }

    @PreAuthorize("hasRole('LANDLORD')")
    @DeleteMapping("/{id}/images/{imageId}")
    @Operation(summary = "Delete a listing image")
    @SecurityRequirement(name = "bearerAuth")
    public ResponseEntity<Map<String, String>> deleteImage(@PathVariable UUID id,
                                                           @PathVariable UUID imageId,
                                                           @AuthenticationPrincipal UserDetails userDetails){
        listingService.deleteImage(id, imageId, userDetails.getUsername());
        return ResponseEntity.ok(Map.of("message", "Зображення успішно видалено"));
    }

    @PreAuthorize("hasRole('LANDLORD')")
    @PatchMapping("/{id}/images/{imageId}/primary")
    @Operation(summary = "Set a listing's primary image")
    @SecurityRequirement(name = "bearerAuth")
    public ResponseEntity<ListingImageDto> setPrimaryImage(@PathVariable UUID id,
                                                           @PathVariable UUID imageId,
                                                           @AuthenticationPrincipal UserDetails userDetails){
        ListingImageDto result = listingService.setPrimaryImage(id, imageId, userDetails.getUsername());
        return ResponseEntity.ok(result);
    }
}
