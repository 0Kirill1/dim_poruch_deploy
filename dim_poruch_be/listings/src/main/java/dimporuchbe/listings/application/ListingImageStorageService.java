package dimporuchbe.listings.application;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.FileSystemResource;
import org.springframework.core.io.Resource;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.util.UUID;
import java.util.stream.Stream;

import static org.springframework.http.HttpStatus.BAD_REQUEST;
import static org.springframework.http.HttpStatus.INTERNAL_SERVER_ERROR;
import static org.springframework.http.HttpStatus.NOT_FOUND;

@Service
public class ListingImageStorageService {
    private static final long MAX_IMAGE_SIZE = 10 * 1024 * 1024;

    private final Path storageRoot;

    public ListingImageStorageService(
            @Value("${app.storage.listings-path:/var/app/uploads/listings}") String storagePath) {
        this.storageRoot = Path.of(storagePath).toAbsolutePath().normalize();
        try {
            Files.createDirectories(storageRoot);
        } catch (IOException exception) {
            throw new IllegalStateException(
                    "Unable to initialize listing image storage at " + storageRoot
                            + ". Ensure the application user can create and write to this directory.",
                    exception);
        }
    }

    public void store(UUID listingId, UUID imageId, MultipartFile file) {
        validate(file);

        String extension = extensionFor(file.getContentType());
        Path listingDirectory = storageRoot.resolve(listingId.toString()).normalize();
        Path target = listingDirectory.resolve(imageId + extension).normalize();

        if (!target.startsWith(storageRoot)) {
            throw new ResponseStatusException(INTERNAL_SERVER_ERROR, "Invalid image storage path");
        }

        try {
            Files.createDirectories(listingDirectory);
            Files.copy(file.getInputStream(), target, StandardCopyOption.REPLACE_EXISTING);
        } catch (IOException exception) {
            throw new ResponseStatusException(
                    INTERNAL_SERVER_ERROR,
                    "Unable to store the listing image at " + target
                            + ". Check storage directory permissions.",
                    exception);
        }
    }

    public Resource load(UUID listingId, UUID imageId) {
        Path imagePath = findImage(listingId, imageId);
        return new FileSystemResource(imagePath);
    }

    public MediaType contentType(UUID listingId, UUID imageId) {
        Path imagePath = findImage(listingId, imageId);
        try {
            String detectedType = Files.probeContentType(imagePath);
            return detectedType == null ? MediaType.APPLICATION_OCTET_STREAM : MediaType.parseMediaType(detectedType);
        } catch (IOException exception) {
            throw new ResponseStatusException(INTERNAL_SERVER_ERROR, "Unable to determine image type", exception);
        }
    }

    public void delete(UUID listingId, UUID imageId) {
        Path listingDirectory = storageRoot.resolve(listingId.toString()).normalize();
        if (!listingDirectory.startsWith(storageRoot)) {
            throw new ResponseStatusException(INTERNAL_SERVER_ERROR, "Invalid image storage path");
        }

        try (Stream<Path> files = Files.exists(listingDirectory)
                ? Files.list(listingDirectory)
                : Stream.empty()) {
            files.filter(path -> path.getFileName().toString().startsWith(imageId + "."))
                    .forEach(this::deleteFile);
        } catch (IOException exception) {
            throw new ResponseStatusException(INTERNAL_SERVER_ERROR, "Unable to delete listing image", exception);
        }
    }

    private Path findImage(UUID listingId, UUID imageId) {
        Path listingDirectory = storageRoot.resolve(listingId.toString()).normalize();
        if (!listingDirectory.startsWith(storageRoot)) {
            throw new ResponseStatusException(INTERNAL_SERVER_ERROR, "Invalid image storage path");
        }

        try (Stream<Path> files = Files.exists(listingDirectory)
                ? Files.list(listingDirectory)
                : Stream.empty()) {
            return files.filter(path -> path.getFileName().toString().startsWith(imageId + "."))
                    .findFirst()
                    .orElseThrow(() -> new ResponseStatusException(NOT_FOUND, "Image file not found"));
        } catch (IOException exception) {
            throw new ResponseStatusException(INTERNAL_SERVER_ERROR, "Unable to read listing image", exception);
        }
    }

    private void deleteFile(Path path) {
        try {
            Files.deleteIfExists(path);
        } catch (IOException exception) {
            throw new ResponseStatusException(INTERNAL_SERVER_ERROR, "Unable to delete listing image", exception);
        }
    }

    private void validate(MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw new ResponseStatusException(BAD_REQUEST, "Image file is required");
        }
        if (file.getSize() > MAX_IMAGE_SIZE) {
            throw new ResponseStatusException(BAD_REQUEST, "Image must not exceed 10 MB");
        }
        if (!isSupportedType(file.getContentType())) {
            throw new ResponseStatusException(BAD_REQUEST, "Only JPEG, PNG, GIF, and WebP images are supported");
        }
    }

    private boolean isSupportedType(String contentType) {
        return MediaType.IMAGE_JPEG_VALUE.equals(contentType)
                || MediaType.IMAGE_PNG_VALUE.equals(contentType)
                || MediaType.IMAGE_GIF_VALUE.equals(contentType)
                || "image/webp".equals(contentType);
    }

    private String extensionFor(String contentType) {
        return switch (contentType) {
            case MediaType.IMAGE_JPEG_VALUE -> ".jpg";
            case MediaType.IMAGE_PNG_VALUE -> ".png";
            case MediaType.IMAGE_GIF_VALUE -> ".gif";
            case "image/webp" -> ".webp";
            default -> throw new ResponseStatusException(BAD_REQUEST, "Unsupported image type");
        };
    }
}
