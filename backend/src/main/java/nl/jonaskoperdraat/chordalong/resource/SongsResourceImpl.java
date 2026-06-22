package nl.jonaskoperdraat.chordalong.resource;

import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.annotation.PostConstruct;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.ws.rs.NotFoundException;
import jakarta.ws.rs.Path;
import nl.jonaskoperdraat.chordalong.api.ApiApi;
import nl.jonaskoperdraat.chordalong.model.PlayBundle;
import nl.jonaskoperdraat.chordalong.model.SongSummary;

import java.io.IOException;
import java.io.InputStream;
import java.util.List;

@Path("/api/songs")
@ApplicationScoped
public class SongsResourceImpl implements ApiApi {

    @Inject
    ObjectMapper objectMapper;

    private PlayBundle photographBundle;

    @PostConstruct
    void init() throws IOException {
        try (InputStream is = getClass().getResourceAsStream("/fixtures/sample.play.json")) {
            if (is == null) throw new IllegalStateException("fixtures/sample.play.json not found on classpath");
            photographBundle = objectMapper.readValue(is, PlayBundle.class);
        }
    }

    @Override
    public List<SongSummary> getSongs() {
        return List.of(new SongSummary().id("photograph").title("Photograph").artist("Nickelback"));
    }

    @Override
    public PlayBundle getSongBundle(String id) {
        if ("photograph".equals(id)) return photographBundle;
        throw new NotFoundException("Song not found: " + id);
    }
}
