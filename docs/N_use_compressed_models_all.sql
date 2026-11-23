-- ============================================================================
-- Modelos 3D comprimidos (.glb con Draco) — 40 asistentes
-- ----------------------------------------------------------------------------
-- Los .gltf originales traían mallas de 3+ millones de triángulos para un visor
-- de 150–320 px. Aquí se apunta a la versión simplificada y comprimida:
--
--   gltf-transform optimize in.gltf out.glb --compress draco --simplify true \
--     --simplify-ratio 0.08 --simplify-error 0.001 --texture-compress false \
--     --texture-size 1024
--
-- Resultado global: 163.0 MB -> 43.3 MB (‑73 %). Un solo archivo por modelo en
-- vez de .gltf + .bin + texturas, con `cache-control` de 1 año en el servidor
-- alterno, así que el CDN no vuelve a pedirlo en cada visita.
--
-- Los originales NO se borran: esta migración solo cambia `gltf_url`. Para
-- revertir un modelo, apunta su `gltf_url` otra vez al .gltf (la ruta vieja
-- queda anotada como comentario en cada bloque).
--
-- OJO: 8 modelos referenciaban una textura que nunca se subió a Storage
-- (`<nombre>1.jpg` devuelve 404). Al comprimirlos esa textura se sustituyó por
-- un PNG blanco de 1x1; se ven igual que ahora, pero sin la petición rota.
-- Ids afectados: 6, 9, 11, 12, 15, 16, 17, 26.
--
-- Idempotente: se puede ejecutar varias veces.
-- ============================================================================

--  3  Harpie's Pet Baby Dragon                    1.20 MB  (antes: babyDragon.gltf)
UPDATE public.spirits SET gltf_url = 'https://res.cloudinary.com/de3n9pg8x/raw/upload/v1795444302/spirits/models/compressed_1795444302/3.glb' WHERE id = 3;
--  4  Ash Blossom & Joyous Spring                 0.66 MB  (antes: ash.gltf)
UPDATE public.spirits SET gltf_url = 'https://res.cloudinary.com/de3n9pg8x/raw/upload/v1795444303/spirits/models/compressed_1795444302/4.glb' WHERE id = 4;
--  6  Blue-Eyes Toon Dragon                       1.03 MB  (antes: toonBlueEyes.gltf)
UPDATE public.spirits SET gltf_url = 'https://res.cloudinary.com/de3n9pg8x/raw/upload/v1795444303/spirits/models/compressed_1795444302/6.glb' WHERE id = 6;
--  7  Condemned Darklord                          1.40 MB  (antes: condemned.gltf)
UPDATE public.spirits SET gltf_url = 'https://res.cloudinary.com/de3n9pg8x/raw/upload/v1795444304/spirits/models/compressed_1795444302/7.glb' WHERE id = 7;
--  8  The First Darklord                          1.64 MB  (antes: primerDarklord.gltf)
UPDATE public.spirits SET gltf_url = 'https://res.cloudinary.com/de3n9pg8x/raw/upload/v1795444305/spirits/models/compressed_1795444302/8.glb' WHERE id = 8;
--  9  Incredible Ecclesia, the Virtuous           1.38 MB  (antes: ecclesia.gltf)
UPDATE public.spirits SET gltf_url = 'https://res.cloudinary.com/de3n9pg8x/raw/upload/v1795444306/spirits/models/compressed_1795444302/9.glb' WHERE id = 9;
-- 10  Winged Kuriboh                              0.72 MB  (antes: wingedKuriboh.gltf)
UPDATE public.spirits SET gltf_url = 'https://res.cloudinary.com/de3n9pg8x/raw/upload/v1795444307/spirits/models/compressed_1795444302/10.glb' WHERE id = 10;
-- 11  Toon Dark Magician Girl                     1.03 MB  (antes: MagaToon.gltf)
UPDATE public.spirits SET gltf_url = 'https://res.cloudinary.com/de3n9pg8x/raw/upload/v1795444308/spirits/models/compressed_1795444302/11.glb' WHERE id = 11;
-- 12  Sky Striker Ace - Raye                      0.89 MB  (antes: raye.gltf)
UPDATE public.spirits SET gltf_url = 'https://res.cloudinary.com/de3n9pg8x/raw/upload/v1795444308/spirits/models/compressed_1795444302/12.glb' WHERE id = 12;
-- 13  Stardust Dragon                             1.05 MB  (antes: stardust.gltf)
UPDATE public.spirits SET gltf_url = 'https://res.cloudinary.com/de3n9pg8x/raw/upload/v1795444309/spirits/models/compressed_1795444302/13.glb' WHERE id = 13;
-- 15  Card Ejector                                0.93 MB  (antes: CardEjector.gltf)
UPDATE public.spirits SET gltf_url = 'https://res.cloudinary.com/de3n9pg8x/raw/upload/v1795444310/spirits/models/compressed_1795444302/15.glb' WHERE id = 15;
-- 16  Effect Veiler                               0.70 MB  (antes: effectVeiler.gltf)
UPDATE public.spirits SET gltf_url = 'https://res.cloudinary.com/de3n9pg8x/raw/upload/v1795444310/spirits/models/compressed_1795444302/16.glb' WHERE id = 16;
-- 17  Winged Kuriboh LV6                          0.74 MB  (antes: EheroKuriboh.gltf)
UPDATE public.spirits SET gltf_url = 'https://res.cloudinary.com/de3n9pg8x/raw/upload/v1795444311/spirits/models/compressed_1795444302/17.glb' WHERE id = 17;
-- 20  Gagaga Girl                                 1.18 MB  (antes: gagaga.gltf)
UPDATE public.spirits SET gltf_url = 'https://res.cloudinary.com/de3n9pg8x/raw/upload/v1795444312/spirits/models/compressed_1795444302/20.glb' WHERE id = 20;
-- 22  Power Tool Dragon                           0.71 MB  (antes: powerTool.gltf)
UPDATE public.spirits SET gltf_url = 'https://res.cloudinary.com/de3n9pg8x/raw/upload/v1795444312/spirits/models/compressed_1795444302/22.glb' WHERE id = 22;
-- 23  Nightmare Apprentice                        1.27 MB  (antes: aprendis.gltf)
UPDATE public.spirits SET gltf_url = 'https://res.cloudinary.com/de3n9pg8x/raw/upload/v1795444313/spirits/models/compressed_1795444302/23.glb' WHERE id = 23;
-- 24  Tour Guide From the Underworld              0.66 MB  (antes: tourGuide.gltf)
UPDATE public.spirits SET gltf_url = 'https://res.cloudinary.com/de3n9pg8x/raw/upload/v1795444314/spirits/models/compressed_1795444302/24.glb' WHERE id = 24;
-- 26  Gagaga Girl AA                              0.63 MB  (antes: gagagaGirlAA.gltf)
UPDATE public.spirits SET gltf_url = 'https://res.cloudinary.com/de3n9pg8x/raw/upload/v1795444314/spirits/models/compressed_1795444302/26.glb' WHERE id = 26;
-- 27  Astellar of the White Forest                0.79 MB  (antes: astellar.gltf)
UPDATE public.spirits SET gltf_url = 'https://res.cloudinary.com/de3n9pg8x/raw/upload/v1795444315/spirits/models/compressed_1795444302/27.glb' WHERE id = 27;
-- 29  Kurikara Divincarnate                       0.97 MB  (antes: kurikara%20divincarnate.gltf)
UPDATE public.spirits SET gltf_url = 'https://res.cloudinary.com/de3n9pg8x/raw/upload/v1795444315/spirits/models/compressed_1795444302/29.glb' WHERE id = 29;
-- 30  Eria the Water Charmer                      0.81 MB  (antes: charmerTierra.gltf)
UPDATE public.spirits SET gltf_url = 'https://res.cloudinary.com/de3n9pg8x/raw/upload/v1795444316/spirits/models/compressed_1795444302/30.glb' WHERE id = 30;
-- 32  Aussa the Earth Charmer                     0.75 MB  (antes: charmerAgua.gltf)
UPDATE public.spirits SET gltf_url = 'https://res.cloudinary.com/de3n9pg8x/raw/upload/v1795444317/spirits/models/compressed_1795444302/32.glb' WHERE id = 32;
-- 34  Doministia Rosepamela                       1.34 MB  (antes: purge.gltf)
UPDATE public.spirits SET gltf_url = 'https://res.cloudinary.com/de3n9pg8x/raw/upload/v1795444317/spirits/models/compressed_1795444302/34.glb' WHERE id = 34;
-- 37  Clown Crew Biancaviso                       0.93 MB  (antes: Biancaviso.gltf)
UPDATE public.spirits SET gltf_url = 'https://res.cloudinary.com/de3n9pg8x/raw/upload/v1795444318/spirits/models/compressed_1795444302/37.glb' WHERE id = 37;
-- 38  Darklord Morningstar                        1.47 MB  (antes: lucy2.gltf)
UPDATE public.spirits SET gltf_url = 'https://res.cloudinary.com/de3n9pg8x/raw/upload/v1795444319/spirits/models/compressed_1795444302/38.glb' WHERE id = 38;
-- 39  Dark Magician Developer                     2.40 MB  (antes: mago%20BETA.gltf)
UPDATE public.spirits SET gltf_url = 'https://res.cloudinary.com/de3n9pg8x/raw/upload/v1795444320/spirits/models/compressed_1795444302/39.glb' WHERE id = 39;
-- 40  Maga Oscura Developer                       1.43 MB  (antes: MagaOscuraMantenimiento.gltf)
UPDATE public.spirits SET gltf_url = 'https://res.cloudinary.com/de3n9pg8x/raw/upload/v1795444320/spirits/models/compressed_1795444302/40.glb' WHERE id = 40;
-- 41  Ancient Fairy Dragon                        1.12 MB  (antes: ancientfairy.gltf)
UPDATE public.spirits SET gltf_url = 'https://res.cloudinary.com/de3n9pg8x/raw/upload/v1795444321/spirits/models/compressed_1795444302/41.glb' WHERE id = 41;
-- 42  Black Rose Dragon                           0.99 MB  (antes: rosa.gltf)
UPDATE public.spirits SET gltf_url = 'https://res.cloudinary.com/de3n9pg8x/raw/upload/v1795444322/spirits/models/compressed_1795444302/42.glb' WHERE id = 42;
-- 43  Darklord Nurse                              1.21 MB  (antes: nurse.gltf)
UPDATE public.spirits SET gltf_url = 'https://res.cloudinary.com/de3n9pg8x/raw/upload/v1795444322/spirits/models/compressed_1795444302/43.glb' WHERE id = 43;
-- 44  Diabellstar the Black Witch                 1.61 MB  (antes: diabell.gltf)
UPDATE public.spirits SET gltf_url = 'https://res.cloudinary.com/de3n9pg8x/raw/upload/v1795444323/spirits/models/compressed_1795444302/44.glb' WHERE id = 44;
-- 45  Sky Striker Mobilize - Engage!              1.70 MB  (antes: engage.gltf)
UPDATE public.spirits SET gltf_url = 'https://res.cloudinary.com/de3n9pg8x/raw/upload/v1795444324/spirits/models/compressed_1795444302/45.glb' WHERE id = 45;
-- 47  Fabled Krus                                 0.82 MB  (antes: kruz.gltf)
UPDATE public.spirits SET gltf_url = 'https://res.cloudinary.com/de3n9pg8x/raw/upload/v1795444324/spirits/models/compressed_1795444302/47.glb' WHERE id = 47;
-- 48  Minerva, Lightsworn Maiden                  0.83 MB  (antes: minerva.gltf)
UPDATE public.spirits SET gltf_url = 'https://res.cloudinary.com/de3n9pg8x/raw/upload/v1795444325/spirits/models/compressed_1795444302/48.glb' WHERE id = 48;
-- 49  Rainbow Dragon                              0.85 MB  (antes: rainbowDragon.gltf)
UPDATE public.spirits SET gltf_url = 'https://res.cloudinary.com/de3n9pg8x/raw/upload/v1795444326/spirits/models/compressed_1795444302/49.glb' WHERE id = 49;
-- 51  Solemn Judgment                             1.05 MB  (antes: solemnJ.gltf)
UPDATE public.spirits SET gltf_url = 'https://res.cloudinary.com/de3n9pg8x/raw/upload/v1795444327/spirits/models/compressed_1795444302/51.glb' WHERE id = 51;
-- 52  Tour Guide                                  0.82 MB  (antes: guidev2.gltf)
UPDATE public.spirits SET gltf_url = 'https://res.cloudinary.com/de3n9pg8x/raw/upload/v1795444327/spirits/models/compressed_1795444302/52.glb' WHERE id = 52;
-- 53  A Bao A Qu, the Lightless Shadow            1.66 MB  (antes: abao.gltf)
UPDATE public.spirits SET gltf_url = 'https://res.cloudinary.com/de3n9pg8x/raw/upload/v1795444328/spirits/models/compressed_1795444302/53.glb' WHERE id = 53;
-- 55  Galatea, the Orcust Automaton               0.97 MB  (antes: galatea.gltf)
UPDATE public.spirits SET gltf_url = 'https://res.cloudinary.com/de3n9pg8x/raw/upload/v1795444329/spirits/models/compressed_1795444302/55.glb' WHERE id = 55;
-- 56  Witch of the Black Rose                     1.04 MB  (antes: rosabruja.gltf)
UPDATE public.spirits SET gltf_url = 'https://res.cloudinary.com/de3n9pg8x/raw/upload/v1795444329/spirits/models/compressed_1795444302/56.glb' WHERE id = 56;

-- Recargar la caché de esquema de PostgREST (por si el panel tiene el esquema viejo).
NOTIFY pgrst, 'reload schema';
