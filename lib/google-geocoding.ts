export interface ReverseGeocodedAddress {
  streetAddress: string | null;
  city: string | null;
  region: string | null;
  country: string | null;
  postalCode: string | null;
  formattedAddress: string;
  placeId: string | null;
  geocodingLocationType: string | null;
}

interface GoogleAddressComponent {
  long_name?: string;
  short_name?: string;
  types?: string[];
}

interface GoogleGeocodingResult {
  address_components?: GoogleAddressComponent[];
  formatted_address?: string;
  place_id?: string;
  geometry?: { location_type?: string };
}

interface GoogleGeocodingResponse {
  status?: string;
  results?: GoogleGeocodingResult[];
  error_message?: string;
}

function component(
  components: GoogleAddressComponent[],
  types: string[],
  useShortName = false
): string | null {
  for (const type of types) {
    const match = components.find((item) => item.types?.includes(type));
    const value = useShortName ? match?.short_name : match?.long_name;
    if (value?.trim()) return value.trim();
  }
  return null;
}

export function parseGoogleGeocodingResult(
  result: GoogleGeocodingResult
): ReverseGeocodedAddress | null {
  const components = result.address_components ?? [];
  const streetNumber = component(components, ["street_number"]);
  const route = component(components, ["route"]);
  const subpremise = component(components, ["subpremise"]);
  const streetAddress = [subpremise, streetNumber, route].filter(Boolean).join(" ") || null;
  const city = component(components, [
    "locality",
    "postal_town",
    "administrative_area_level_2",
    "sublocality_level_1"
  ]);
  const region = component(components, ["administrative_area_level_1"]);
  const country = component(components, ["country"]);
  const postalCode = component(components, ["postal_code"]);
  const formattedAddress = result.formatted_address?.trim() ?? "";
  if (!formattedAddress && !streetAddress && !city && !region && !country) return null;
  return {
    streetAddress,
    city,
    region,
    country,
    postalCode,
    formattedAddress: formattedAddress || [streetAddress, city, region, country].filter(Boolean).join(", "),
    placeId: result.place_id?.trim() || null,
    geocodingLocationType: result.geometry?.location_type?.trim() || null
  };
}

export async function reverseGeocode(
  latitude: number,
  longitude: number
): Promise<ReverseGeocodedAddress | null> {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY?.trim();
  if (!apiKey) return null;
  const url = new URL("https://maps.googleapis.com/maps/api/geocode/json");
  url.searchParams.set("latlng", `${latitude},${longitude}`);
  url.searchParams.set("key", apiKey);
  const response = await fetch(url, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(8_000)
  });
  if (!response.ok) throw new Error(`Google Geocoding request failed with ${response.status}.`);
  const payload = await response.json() as GoogleGeocodingResponse;
  if (payload.status === "ZERO_RESULTS") return null;
  if (payload.status !== "OK") throw new Error(`Google Geocoding failed: ${payload.status ?? "UNKNOWN_ERROR"}.`);
  const result = payload.results?.[0];
  return result ? parseGoogleGeocodingResult(result) : null;
}
