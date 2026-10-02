import { z } from 'zod';
import type { SocialPost } from '../../shared/domain';
import type { SocialProvider } from './contracts';
import { endpoint, providerGet } from './transport';
export class XSocialProvider implements SocialProvider {
  readonly name = 'X API';
  constructor(private token: string) {}
  async posts(username: string): Promise<SocialPost[]> {
    const headers = { Authorization: `Bearer ${this.token}` };
    const user = z
      .object({ data: z.object({ id: z.string(), name: z.string(), username: z.string() }) })
      .parse(
        await providerGet(
          this.name,
          `https://api.x.com/2/users/by/username/${encodeURIComponent(username)}`,
          headers,
        ),
      );
    const tweets = z
      .object({
        data: z
          .array(
            z.object({
              id: z.string(),
              text: z.string(),
              created_at: z.iso.datetime(),
              attachments: z.object({ media_keys: z.array(z.string()).optional() }).optional(),
            }),
          )
          .optional(),
        includes: z
          .object({
            media: z
              .array(
                z.object({
                  media_key: z.string(),
                  type: z.enum(['photo', 'video', 'animated_gif']),
                  url: z.url().optional(),
                  preview_image_url: z.url().optional(),
                }),
              )
              .optional(),
          })
          .optional(),
      })
      .parse(
        await providerGet(
          this.name,
          endpoint(`https://api.x.com/2/users/${user.data.id}/tweets`, {
            'tweet.fields': 'created_at,attachments',
            expansions: 'attachments.media_keys',
            'media.fields': 'type,url,preview_image_url',
            max_results: '10',
            exclude: 'retweets,replies',
          }),
          headers,
        ),
      );
    return (tweets.data || []).map((p) => ({
      id: p.id,
      author: user.data.name,
      username: user.data.username,
      text: p.text,
      publishedAt: p.created_at,
      url: `https://x.com/${user.data.username}/status/${p.id}`,
      provider: 'X API',
      media: (tweets.includes?.media || []).flatMap((m) => {
        const url = m.type === 'photo' ? m.url : m.preview_image_url;
        return p.attachments?.media_keys?.includes(m.media_key) && url?.startsWith('https://')
          ? [{ url, type: m.type }]
          : [];
      }),
    }));
  }
}
