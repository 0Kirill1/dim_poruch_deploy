package dimporuchbe.listings.application;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.http.HttpStatus;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.web.server.ResponseStatusException;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class ListingImageStorageServiceTest {

    @TempDir
    Path storageRoot;

    @Test
    void storesSupportedImageUnderTheListingDirectory() throws IOException {
        ListingImageStorageService storageService = new ListingImageStorageService(storageRoot.toString());
        UUID listingId = UUID.randomUUID();
        UUID imageId = UUID.randomUUID();
        byte[] imageContent = {0x01, 0x02, 0x03, 0x04};
        MockMultipartFile image = new MockMultipartFile(
                "file",
                "apartment.png",
                "image/png",
                imageContent
        );

        storageService.store(listingId, imageId, image);

        Path storedImage = storageRoot.resolve(listingId.toString()).resolve(imageId + ".png");
        assertThat(storedImage).exists().isRegularFile();
        assertThat(Files.readAllBytes(storedImage)).containsExactly(imageContent);
    }

    @Test
    void rejectsUnsupportedImageFormat() {
        ListingImageStorageService storageService = new ListingImageStorageService(storageRoot.toString());
        UUID listingId = UUID.randomUUID();
        UUID imageId = UUID.randomUUID();
        MockMultipartFile image = new MockMultipartFile(
                "file",
                "apartment.svg",
                "image/svg+xml",
                "<svg/>".getBytes()
        );

        assertThatThrownBy(() -> storageService.store(listingId, imageId, image))
                .isInstanceOfSatisfying(ResponseStatusException.class, exception -> {
                    assertThat(exception.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
                    assertThat(exception.getReason()).contains("Only JPEG, PNG, GIF, and WebP");
                });

        assertThat(storageRoot.resolve(listingId.toString())).doesNotExist();
    }
}
