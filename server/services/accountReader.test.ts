import { afterEach, describe, expect, it, vi } from 'vitest';
import firebaseConfig from '../../firebase-applet-config.json';
import { readOwnedCollection } from './accountReader';
vi.mock('./firebaseAdmin', () => ({ getAdminDatabase: () => null }));
const resource = `projects/${firebaseConfig.projectId}/databases/${firebaseConfig.firestoreDatabaseId}/documents/users/owner/watchlists`;
afterEach(() => vi.unstubAllGlobals());
describe('authenticated account REST reads', () => {
  it('uses the caller token and decodes owned nested records without Admin credentials', async () => {
    const fetcher = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          documents: [
            {
              name: `${resource}/tech`,
              fields: {
                name: { stringValue: 'Tech' },
                pinned: { booleanValue: true },
                assets: {
                  arrayValue: {
                    values: [
                      {
                        mapValue: {
                          fields: {
                            symbol: { stringValue: 'AAPL' },
                            type: { stringValue: 'stock' },
                            name: { stringValue: 'Apple' },
                          },
                        },
                      },
                    ],
                  },
                },
              },
            },
          ],
        }),
        { status: 200 },
      ),
    );
    vi.stubGlobal('fetch', fetcher);
    const records = await readOwnedCollection('owner', 'watchlists', 10, 'test-id-token');
    expect(records).toEqual([
      {
        id: 'tech',
        data: {
          name: 'Tech',
          pinned: true,
          assets: [{ symbol: 'AAPL', type: 'stock', name: 'Apple' }],
        },
      },
    ]);
    expect(fetcher.mock.calls[0][0]).toContain('/documents/users/owner/watchlists?pageSize=10');
    expect(fetcher.mock.calls[0][1].headers.Authorization).toBe('Bearer test-id-token');
    expect(fetcher.mock.calls[0][1].redirect).toBe('error');
  });
  it('rejects a document outside the verified owner scope', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            documents: [{ name: resource.replace('/owner/', '/other/') + '/tech', fields: {} }],
          }),
        ),
      ),
    );
    await expect(readOwnedCollection('owner', 'watchlists', 10, 'test-token')).rejects.toThrow(
      'scope',
    );
  });
  it('preserves permission errors instead of returning a false empty portfolio', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}', { status: 403 })));
    await expect(readOwnedCollection('owner', 'watchlists', 10, 'test-token')).rejects.toThrow(
      'access denied',
    );
  });
  it('rejects missing authentication and invalid paths before making a request', async () => {
    const fetcher = vi.fn();
    vi.stubGlobal('fetch', fetcher);
    await expect(readOwnedCollection('owner', 'assets', 30)).rejects.toThrow('Authenticated');
    await expect(readOwnedCollection('../other', 'assets', 30, 'test-token')).rejects.toThrow(
      'Invalid',
    );
    expect(fetcher).not.toHaveBeenCalled();
  });
});
