package dimporuchbe.listings.application;

import dimporuchbe.listings.api.dtos.CreateListingRequestDto;
import dimporuchbe.listings.api.dtos.CreateListingResponseDto;
import dimporuchbe.listings.api.dtos.ListingDto;
import dimporuchbe.listings.api.dtos.ListingImageDto;
import dimporuchbe.listings.api.dtos.ListingSearchDto;
import dimporuchbe.listings.api.dtos.UpdateListingDto;
import dimporuchbe.listings.persistence.Listing;
import dimporuchbe.listings.persistence.ListingImage;
import dimporuchbe.listings.persistence.ListingImageRepository;
import dimporuchbe.listings.persistence.ListingRepository;
import dimporuchbe.listings.persistence.PropertyType;
import dimporuchbe.listings.persistence.Status;
import dimporuchbe.user.persistence.User;
import dimporuchbe.user.persistence.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.core.io.Resource;
import org.springframework.http.MediaType;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.web.multipart.MultipartFile;

import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class ListingService {
    private final ListingRepository listingRepository;
    private final ListingImageRepository listingImageRepository;
    private final UserRepository userRepository;
    private final ListingImageStorageService listingImageStorageService;

    @Transactional
    public CreateListingResponseDto createListing(CreateListingRequestDto dto, String userEmail){
        User owner = userRepository.findByEmail(userEmail)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found"));

        Listing newListing = Listing.builder()
                .title(dto.getTitle())
                .description(dto.getDescription())
                .city(dto.getCity())
                .address(dto.getAddress())
                .monthlyPrice(dto.getMonthlyPrice())
                .rooms(dto.getRooms())
                .area(dto.getArea())
                .propertyType(PropertyType.valueOf(dto.getPropertyType()))
                .status(Status.MODERATION)
                .createdAt(OffsetDateTime.now())
                .owner(owner)
                .amenities(dto.getAmenities() != null ? new HashSet<>(dto.getAmenities()) : new HashSet<>())
                .build();

        listingRepository.save(newListing);

        return CreateListingResponseDto.builder()
                .listingId(newListing.getId())
                .message("Оголошення успішно створено!")
                .build();
    }

    @Transactional(readOnly = true)
    public ListingDto findListingById(UUID id){
        Listing foundListing = getListingById(id);
        return mapToDto(foundListing);
    }

    @Transactional
    public ListingDto updateListing(UUID id, UpdateListingDto dto, String email){
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found"));
        Listing foundListing = getListingById(id);

        if(!foundListing.getOwner().getId().equals(user.getId())){
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Listing doesn't belong to this user");
        }

        if(dto.getTitle() != null){
            foundListing.setTitle(dto.getTitle());
        }
        if(dto.getDescription() != null){
            foundListing.setDescription(dto.getDescription());
        }
        if(dto.getCity() != null){
            foundListing.setCity(dto.getCity());
            foundListing.setStatus(Status.MODERATION);
        }
        if(dto.getAddress() != null){
            foundListing.setAddress(dto.getAddress());
            foundListing.setStatus(Status.MODERATION);
        }
        if(dto.getMonthlyPrice() != null){
            foundListing.setMonthlyPrice(dto.getMonthlyPrice());
            foundListing.setStatus(Status.MODERATION);
        }
        if(dto.getRooms() != null){
            foundListing.setRooms(dto.getRooms());
        }
        if(dto.getArea() != null){
            foundListing.setArea(dto.getArea());
        }
        if(dto.getPropertyType() != null){
            foundListing.setPropertyType(PropertyType.valueOf(dto.getPropertyType()));
        }
        if(dto.getAmenities() != null){
            foundListing.setAmenities(new HashSet<>(dto.getAmenities()));
        }
        foundListing.setUpdatedAt(OffsetDateTime.now());

        listingRepository.save(foundListing);

        return mapToDto(foundListing);
    }

    @Transactional(readOnly = true)
    public Page<ListingDto> searchListings(ListingSearchDto dto, Pageable pageable){
        Specification<Listing> spec = Specification.where(ListingSpecification.hasStatus(Status.ACTIVE));

        if (dto != null) {
            if (dto.getCity() != null && !dto.getCity().isBlank()) {
                spec = spec.and(ListingSpecification.hasCity(dto.getCity()));
            }
            if (dto.getMinPrice() != null || dto.getMaxPrice() != null) {
                spec = spec.and(ListingSpecification.priceBetween(dto.getMinPrice(), dto.getMaxPrice()));
            }
            if (dto.getRooms() != null) {
                spec = spec.and(ListingSpecification.hasRooms(dto.getRooms()));
            }
            if (dto.getPropertyType() != null){
                spec = spec.and(ListingSpecification.hasPropertyType(PropertyType.valueOf(dto.getPropertyType())));
            }
            if (dto.getAmenity() != null){
                spec = spec.and(ListingSpecification.hasAmenity(dto.getAmenity()));
            }
        }

        Page<Listing> listingsPage = listingRepository.findAll(spec, pageable);
        return listingsPage.map(this::mapToDto);
    }

    @Transactional(readOnly = true)
    public Page<ListingDto> getMyListings(String email, Pageable pageable){
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found"));
        return listingRepository.findByOwner(user, pageable).map(this::mapToDto);
    }

    @Transactional
    public ListingDto updateListingStatus(UUID id, Status newStatus, String email){
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found"));
        Listing foundListing = getListingById(id);

        if(!foundListing.getOwner().getId().equals(user.getId())){
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Listing doesn't belong to this user");
        }

        if(newStatus != Status.ACTIVE && newStatus != Status.ARCHIVED){
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Landlords can only toggle between ACTIVE and ARCHIVED");
        }

        foundListing.setStatus(newStatus);
        foundListing.setUpdatedAt(OffsetDateTime.now());
        listingRepository.save(foundListing);

        return mapToDto(foundListing);
    }

    @Transactional
    public void deleteListing(UUID id, String email){
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found"));
        Listing foundListing = getListingById(id);

        if(!foundListing.getOwner().getId().equals(user.getId())){
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Listing doesn't belong to this user");
        }

        foundListing.setStatus(Status.ARCHIVED);
        foundListing.setUpdatedAt(OffsetDateTime.now());
        listingRepository.save(foundListing);
    }

    @Transactional
    public ListingImageDto addImage(UUID listingId, MultipartFile file, Boolean isPrimary, String email){
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found"));
        Listing listing = getListingById(listingId);

        if(!listing.getOwner().getId().equals(user.getId())){
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Listing doesn't belong to this user");
        }

        List<ListingImage> existingImages = listingImageRepository.findByListingIdOrderByCreatedAtAsc(listingId);
        boolean primary = Boolean.TRUE.equals(isPrimary) || existingImages.isEmpty();

        if (primary && !existingImages.isEmpty()) {
            for (ListingImage img : existingImages) {
                if (Boolean.TRUE.equals(img.getIsPrimary())) {
                    img.setIsPrimary(false);
                    listingImageRepository.save(img);
                }
            }
        }

        ListingImage image = ListingImage.builder()
                .listing(listing)
                .imageUrl("pending")
                .isPrimary(primary)
                .createdAt(OffsetDateTime.now())
                .build();

        try {
            listingImageRepository.saveAndFlush(image);
            UUID imageId = image.getId();
            listingImageStorageService.store(listingId, imageId, file);
            image.setImageUrl("/listings/" + listingId + "/images/" + imageId + "/content");
            listingImageRepository.saveAndFlush(image);
        } catch (RuntimeException exception) {
            if (image.getId() != null) {
                listingImageStorageService.delete(listingId, image.getId());
            }
            throw exception;
        }

        return mapImageToDto(image);
    }

    @Transactional(readOnly = true)
    public List<ListingImageDto> getListingImages(UUID listingId){
        getListingById(listingId); // verify exists
        return listingImageRepository.findByListingIdOrderByCreatedAtAsc(listingId)
                .stream()
                .map(this::mapImageToDto)
                .collect(Collectors.toList());
    }

    @Transactional
    public void deleteImage(UUID listingId, UUID imageId, String email){
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found"));
        Listing listing = getListingById(listingId);

        if(!listing.getOwner().getId().equals(user.getId())){
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Listing doesn't belong to this user");
        }

        ListingImage image = listingImageRepository.findById(imageId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Image not found"));

        if(!image.getListing().getId().equals(listingId)){
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Image does not belong to this listing");
        }

        boolean wasPrimary = Boolean.TRUE.equals(image.getIsPrimary());
        listingImageRepository.delete(image);
        listingImageStorageService.delete(listingId, imageId);

        if (wasPrimary) {
            List<ListingImage> remaining = listingImageRepository.findByListingIdOrderByCreatedAtAsc(listingId);
            if (!remaining.isEmpty()) {
                ListingImage first = remaining.get(0);
                first.setIsPrimary(true);
                listingImageRepository.save(first);
            }

        }
    }

    @Transactional(readOnly = true)
    public Resource getImage(UUID listingId, UUID imageId) {
        ListingImage image = getImageByListing(listingId, imageId);
        return listingImageStorageService.load(listingId, image.getId());
    }

    @Transactional(readOnly = true)
    public MediaType getImageContentType(UUID listingId, UUID imageId) {
        ListingImage image = getImageByListing(listingId, imageId);
        return listingImageStorageService.contentType(listingId, image.getId());
    }

    private ListingImage getImageByListing(UUID listingId, UUID imageId) {
        getListingById(listingId);
        ListingImage image = listingImageRepository.findById(imageId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Image not found"));
        if (!image.getListing().getId().equals(listingId)) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Image not found");
        }
        return image;
    }

    @Transactional
    public ListingImageDto setPrimaryImage(UUID listingId, UUID imageId, String email){
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found"));
        Listing listing = getListingById(listingId);

        if(!listing.getOwner().getId().equals(user.getId())){
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Listing doesn't belong to this user");
        }

        List<ListingImage> images = listingImageRepository.findByListingIdOrderByCreatedAtAsc(listingId);
        ListingImage targetImage = null;

        for (ListingImage img : images) {
            if (img.getId().equals(imageId)) {
                img.setIsPrimary(true);
                targetImage = img;
            } else if (Boolean.TRUE.equals(img.getIsPrimary())) {
                img.setIsPrimary(false);
            }
        }

        if (targetImage == null) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Image not found on this listing");
        }

        listingImageRepository.saveAll(images);
        return mapImageToDto(targetImage);
    }

    private Listing getListingById(UUID id){
        return listingRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Listing not found"));
    }

    private ListingDto mapToDto(Listing listing){
        List<ListingImage> images = listing.getImages() != null ? listing.getImages() : new ArrayList<>();
        String primaryUrl = images.stream()
                .filter(img -> Boolean.TRUE.equals(img.getIsPrimary()))
                .map(ListingImage::getImageUrl)
                .findFirst()
                .orElse(images.isEmpty() ? null : images.get(0).getImageUrl());

        List<String> allUrls = images.stream()
                .map(ListingImage::getImageUrl)
                .collect(Collectors.toList());

        return ListingDto.builder()
                .id(listing.getId())
                .title(listing.getTitle())
                .description(listing.getDescription())
                .city(listing.getCity())
                .address(listing.getAddress())
                .monthlyPrice(listing.getMonthlyPrice())
                .rooms(listing.getRooms())
                .area(listing.getArea())
                .propertyType(listing.getPropertyType() != null ? listing.getPropertyType().name() : null)
                .status(listing.getStatus() != null ? listing.getStatus().name() : null)
                .ownerId(listing.getOwner() != null ? listing.getOwner().getId() : null)
                .primaryImageUrl(primaryUrl)
                .imageUrls(allUrls)
                .amenities(listing.getAmenities() != null ? new HashSet<>(listing.getAmenities()) : new HashSet<>())
                .build();
    }

    private ListingImageDto mapImageToDto(ListingImage image){
        return ListingImageDto.builder()
                .id(image.getId())
                .listingId(image.getListing().getId())
                .imageUrl(image.getImageUrl())
                .isPrimary(image.getIsPrimary())
                .createdAt(image.getCreatedAt())
                .build();
    }
}
