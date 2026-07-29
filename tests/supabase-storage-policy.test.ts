import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve(
    process.cwd(),
    "supabase/migrations/20260729000000_profile_images.sql"
  ),
  "utf8"
);

describe("Supabase profile-images migration", () => {
  it("creates a private, bounded image bucket", () => {
    expect(migration).toContain("'profile-images'");
    expect(migration).toMatch(
      /'profile-images',[\s\S]*'profile-images',[\s\S]*false,[\s\S]*2097152/
    );
    expect(migration).toContain(
      "array['image/jpeg', 'image/png', 'image/webp']"
    );
  });

  it("ties paths and ownership to the Firebase JWT subject", () => {
    expect(migration).toContain("(select auth.jwt()->>'sub')");
    expect(migration).toContain("'https://securetoken.google.com/'");
    expect(migration).toContain("(select auth.jwt()->>'aud')");
    expect(migration).toContain(
      "(storage.foldername(name))[2] = (select auth.jwt()->>'sub')"
    );
    expect(migration).toContain(
      "owner_id = (select auth.jwt()->>'sub')"
    );
    expect(migration).toContain("profile-images restrictive boundary");
  });

  it("allows owner select, insert, and delete but explicitly denies update", () => {
    expect(migration).toMatch(
      /profile-images owner select[\s\S]*for select[\s\S]*to authenticated/
    );
    expect(migration).toMatch(
      /profile-images owner insert[\s\S]*for insert[\s\S]*to authenticated/
    );
    expect(migration).toMatch(
      /profile-images owner delete[\s\S]*for delete[\s\S]*to authenticated/
    );
    expect(migration).toMatch(
      /profile-images deny update[\s\S]*for update[\s\S]*bucket_id <> 'profile-images'/
    );
  });
});
