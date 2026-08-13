#pragma bank 11

#include "sha256.h"

/* Small streaming SHA-256. The container receiver checks this digest before it
 * ever offers the destructive database replacement. */
static const uint32_t K[64] = {
    0x428A2F98ul, 0x71374491ul, 0xB5C0FBCFul, 0xE9B5DBA5ul, 0x3956C25Bul, 0x59F111F1ul,
    0x923F82A4ul, 0xAB1C5ED5ul, 0xD807AA98ul, 0x12835B01ul, 0x243185BEul, 0x550C7DC3ul,
    0x72BE5D74ul, 0x80DEB1FEul, 0x9BDC06A7ul, 0xC19BF174ul, 0xE49B69C1ul, 0xEFBE4786ul,
    0x0FC19DC6ul, 0x240CA1CCul, 0x2DE92C6Ful, 0x4A7484AAul, 0x5CB0A9DCul, 0x76F988DAul,
    0x983E5152ul, 0xA831C66Dul, 0xB00327C8ul, 0xBF597FC7ul, 0xC6E00BF3ul, 0xD5A79147ul,
    0x06CA6351ul, 0x14292967ul, 0x27B70A85ul, 0x2E1B2138ul, 0x4D2C6DFCul, 0x53380D13ul,
    0x650A7354ul, 0x766A0ABBul, 0x81C2C92Eul, 0x92722C85ul, 0xA2BFE8A1ul, 0xA81A664Bul,
    0xC24B8B70ul, 0xC76C51A3ul, 0xD192E819ul, 0xD6990624ul, 0xF40E3585ul, 0x106AA070ul,
    0x19A4C116ul, 0x1E376C08ul, 0x2748774Cul, 0x34B0BCB5ul, 0x391C0CB3ul, 0x4ED8AA4Aul,
    0x5B9CCA4Ful, 0x682E6FF3ul, 0x748F82EEul, 0x78A5636Ful, 0x84C87814ul, 0x8CC70208ul,
    0x90BEFFFAul, 0xA4506CEBul, 0xBEF9A3F7ul, 0xC67178F2ul,
};

static uint32_t rotr(uint32_t value, uint8_t bits) {
    return (value >> bits) | (value << (32u - bits));
}

static uint32_t read_be32(const uint8_t *p) {
    return ((uint32_t)p[0] << 24u) | ((uint32_t)p[1] << 16u) | ((uint32_t)p[2] << 8u) | p[3];
}

static void transform(OpticalSha256 *ctx) {
    uint32_t w[16];
    uint32_t a, b, c, d, e, f, g, h;
    uint32_t s0, s1, ch, maj, temp1, temp2;
    uint8_t i;

    for (i = 0u; i != 16u; ++i)
        w[i] = read_be32(&ctx->block[(uint8_t)(i * 4u)]);
    a = ctx->state[0];
    b = ctx->state[1];
    c = ctx->state[2];
    d = ctx->state[3];
    e = ctx->state[4];
    f = ctx->state[5];
    g = ctx->state[6];
    h = ctx->state[7];

    for (i = 0u; i != 64u; ++i) {
        if (i >= 16u) {
            s0 = rotr(w[(uint8_t)((i - 15u) & 15u)], 7u) ^
                 rotr(w[(uint8_t)((i - 15u) & 15u)], 18u) ^ (w[(uint8_t)((i - 15u) & 15u)] >> 3u);
            s1 = rotr(w[(uint8_t)((i - 2u) & 15u)], 17u) ^ rotr(w[(uint8_t)((i - 2u) & 15u)], 19u) ^
                 (w[(uint8_t)((i - 2u) & 15u)] >> 10u);
            w[i & 15u] += s0 + w[(uint8_t)((i - 7u) & 15u)] + s1;
        }
        s1 = rotr(e, 6u) ^ rotr(e, 11u) ^ rotr(e, 25u);
        ch = (e & f) ^ ((~e) & g);
        temp1 = h + s1 + ch + K[i] + w[i & 15u];
        s0 = rotr(a, 2u) ^ rotr(a, 13u) ^ rotr(a, 22u);
        maj = (a & b) ^ (a & c) ^ (b & c);
        temp2 = s0 + maj;
        h = g;
        g = f;
        f = e;
        e = d + temp1;
        d = c;
        c = b;
        b = a;
        a = temp1 + temp2;
    }

    ctx->state[0] += a;
    ctx->state[1] += b;
    ctx->state[2] += c;
    ctx->state[3] += d;
    ctx->state[4] += e;
    ctx->state[5] += f;
    ctx->state[6] += g;
    ctx->state[7] += h;
}

void optical_sha256_init(OpticalSha256 *ctx) {
    static const uint32_t initial[8] = {
        0x6A09E667ul, 0xBB67AE85ul, 0x3C6EF372ul, 0xA54FF53Aul,
        0x510E527Ful, 0x9B05688Cul, 0x1F83D9ABul, 0x5BE0CD19ul,
    };
    uint8_t i;
    for (i = 0u; i != 8u; ++i)
        ctx->state[i] = initial[i];
    ctx->byte_count = 0ul;
    ctx->block_len = 0u;
}

void optical_sha256_byte(OpticalSha256 *ctx, uint8_t value) {
    ctx->block[ctx->block_len++] = value;
    ++ctx->byte_count;
    if (ctx->block_len == 64u) {
        transform(ctx);
        ctx->block_len = 0u;
    }
}

void optical_sha256_finish(OpticalSha256 *ctx, uint8_t digest[32]) {
    uint32_t bit_low = ctx->byte_count << 3u;
    uint32_t bit_high = ctx->byte_count >> 29u;
    uint8_t i;

    optical_sha256_byte(ctx, 0x80u);
    while (ctx->block_len != 56u)
        optical_sha256_byte(ctx, 0u);
    for (i = 0u; i != 4u; ++i)
        optical_sha256_byte(ctx, (uint8_t)(bit_high >> (24u - i * 8u)));
    for (i = 0u; i != 4u; ++i)
        optical_sha256_byte(ctx, (uint8_t)(bit_low >> (24u - i * 8u)));

    for (i = 0u; i != 8u; ++i) {
        digest[i * 4u] = (uint8_t)(ctx->state[i] >> 24u);
        digest[i * 4u + 1u] = (uint8_t)(ctx->state[i] >> 16u);
        digest[i * 4u + 2u] = (uint8_t)(ctx->state[i] >> 8u);
        digest[i * 4u + 3u] = (uint8_t)ctx->state[i];
    }
}
