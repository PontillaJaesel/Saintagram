import { afterEach, describe, expect, it, vi } from "vitest";
import { parseGoogleGeocodingResult, reverseGeocode } from "@/lib/google-geocoding";

const result = {
  formatted_address: "12 Rizal Street, Batangas City, Batangas 4200, Philippines",
  place_id: "place-1",
  geometry: { location_type: "ROOFTOP" },
  address_components: [
    { long_name: "12", types: ["street_number"] },
    { long_name: "Rizal Street", types: ["route"] },
    { long_name: "Batangas City", types: ["locality"] },
    { long_name: "Batangas", types: ["administrative_area_level_1"] },
    { long_name: "Philippines", short_name: "PH", types: ["country"] },
    { long_name: "4200", types: ["postal_code"] }
  ]
};

describe("Google reverse geocoding", () => {
  const originalKey = process.env.GOOGLE_MAPS_API_KEY;
  afterEach(() => {
    vi.restoreAllMocks();
    if (originalKey === undefined) delete process.env.GOOGLE_MAPS_API_KEY;
    else process.env.GOOGLE_MAPS_API_KEY = originalKey;
  });

  it("extracts structured street, city, region, and country fields", () => {
    expect(parseGoogleGeocodingResult(result)).toMatchObject({
      streetAddress: "12 Rizal Street",
      city: "Batangas City",
      region: "Batangas",
      country: "Philippines",
      postalCode: "4200",
      geocodingLocationType: "ROOFTOP"
    });
  });

  it("keeps the server key out of browser code and calls Google only when configured", async () => {
    delete process.env.GOOGLE_MAPS_API_KEY;
    const fetchMock = vi.spyOn(globalThis, "fetch");
    await expect(reverseGeocode(13.75, 121.05)).resolves.toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();

    process.env.GOOGLE_MAPS_API_KEY = "server-secret";
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ status: "OK", results: [result] }), { status: 200 }));
    await expect(reverseGeocode(13.75, 121.05)).resolves.toMatchObject({ city: "Batangas City" });
    const requestedUrl = String(fetchMock.mock.calls[0]?.[0]);
    expect(requestedUrl).toContain("latlng=13.75%2C121.05");
    expect(requestedUrl).toContain("key=server-secret");
  });
});
