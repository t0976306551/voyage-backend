import { guardSsrf, parseUrl, detectCategory } from '../../../src/modules/import/import.service';

jest.mock('dns/promises', () => ({
  lookup: jest.fn(),
}));

const { lookup } = jest.requireMock('dns/promises') as { lookup: jest.Mock };

const mockFetch = jest.fn() as jest.Mock;
global.fetch = mockFetch as typeof fetch;

function makeLookup(ip: string) {
  lookup.mockResolvedValue({ address: ip, family: 4 });
}

function makeHtmlResponse(html: string) {
  mockFetch.mockResolvedValue({
    url: 'https://www.instagram.com/p/test123/',
    text: () => Promise.resolve(html),
  } as unknown as Response);
}

describe('guardSsrf', () => {
  it('throws INVALID_URL for non-URL input', async () => {
    await expect(guardSsrf('not a url')).rejects.toThrow('INVALID_URL');
  });

  it('throws HTTPS_REQUIRED for http URLs', async () => {
    await expect(guardSsrf('http://example.com/maps')).rejects.toThrow('HTTPS_REQUIRED');
  });

  it('throws PRIVATE_HOST for 192.168.x.x', async () => {
    lookup.mockResolvedValue({ address: '192.168.1.1', family: 4 });
    await expect(guardSsrf('https://internal.example.com/')).rejects.toThrow('PRIVATE_HOST');
  });

  it('throws PRIVATE_HOST for 10.x.x.x', async () => {
    lookup.mockResolvedValue({ address: '10.0.0.1', family: 4 });
    await expect(guardSsrf('https://corp.example.com/')).rejects.toThrow('PRIVATE_HOST');
  });

  it('throws PRIVATE_HOST for 127.x.x.x', async () => {
    lookup.mockResolvedValue({ address: '127.0.0.1', family: 4 });
    await expect(guardSsrf('https://localhost/')).rejects.toThrow('PRIVATE_HOST');
  });

  it('allows public IP', async () => {
    makeLookup('93.184.216.34');
    const parsed = await guardSsrf('https://example.com/');
    expect(parsed.hostname).toBe('example.com');
  });
});

describe('detectCategory', () => {
  it('returns lodging for hotel keywords', () => {
    expect(detectCategory('Grand Hotel Tokyo')).toBe('lodging');
    expect(detectCategory('山中旅館')).toBe('lodging');
    expect(detectCategory('Budget Hostel')).toBe('lodging');
  });

  it('returns food for restaurant/cafe keywords', () => {
    expect(detectCategory('Sushi Bar Ginza')).toBe('food');
    expect(detectCategory('台北咖啡廳')).toBe('food');
    expect(detectCategory('Ramen Shop')).toBe('food');
  });

  it('returns transport for station/airport keywords', () => {
    expect(detectCategory('Tokyo Station')).toBe('transport');
    expect(detectCategory('桃園機場')).toBe('transport');
  });

  it('returns activity for experience/tour keywords', () => {
    expect(detectCategory('Escape Room Adventure')).toBe('activity');
    expect(detectCategory('溫泉體驗')).toBe('activity');
  });

  it('returns attraction as default', () => {
    expect(detectCategory('Eiffel Tower')).toBe('attraction');
    expect(detectCategory('台北101')).toBe('attraction');
  });
});

describe('parseUrl — Google Maps long URL', () => {
  beforeEach(() => makeLookup('142.250.74.46'));

  it('extracts lat/lng from @lat,lng pattern', async () => {
    mockFetch.mockResolvedValue({
      url: 'https://www.google.com/maps/place/Taipei/@25.0329636,121.5654268,14z',
      text: () => Promise.resolve(''),
    } as unknown as Response);
    const result = await parseUrl(
      'https://www.google.com/maps/place/Taipei/@25.0329636,121.5654268,14z',
    );
    expect(result.lat).toBeCloseTo(25.0329636);
    expect(result.lng).toBeCloseTo(121.5654268);
    expect(result.title).toBe('Google Maps 地點');
    expect(result.category).toBe('attraction');
    expect(result.sourceUrl).toBe(
      'https://www.google.com/maps/place/Taipei/@25.0329636,121.5654268,14z',
    );
  });

  it('extracts place name from q= param', async () => {
    mockFetch.mockResolvedValue({
      url: 'https://www.google.com/maps?q=台北101&ll=@25.033,121.565',
      text: () => Promise.resolve(''),
    } as unknown as Response);
    const result = await parseUrl('https://www.google.com/maps?q=%E5%8F%B0%E5%8C%97101');
    expect(result.title).toBe('台北101');
    expect(result.category).toBe('attraction');
  });
});

describe('parseUrl — Instagram', () => {
  beforeEach(() => makeLookup('157.240.221.174'));

  it('extracts og:title and og:image', async () => {
    makeHtmlResponse(
      `<html><head>
        <meta property="og:title" content="台北美食推薦" />
        <meta property="og:image" content="https://cdn.instagram.com/image.jpg" />
      </head></html>`,
    );
    const result = await parseUrl('https://www.instagram.com/p/test123/');
    expect(result.title).toBe('台北美食推薦');
    expect(result.category).toBe('food');
    expect(result.coverImage).toBe('https://cdn.instagram.com/image.jpg');
    expect(result.sourceUrl).toBe('https://www.instagram.com/p/test123/');
  });

  it('throws INSTAGRAM_NO_IMAGE when og:image is missing', async () => {
    makeHtmlResponse('<html><head><meta property="og:title" content="test" /></head></html>');
    await expect(parseUrl('https://www.instagram.com/p/test123/')).rejects.toThrow('INSTAGRAM_NO_IMAGE');
  });
});

describe('parseUrl — unsupported source', () => {
  it('throws UNSUPPORTED_SOURCE for unrecognized domain', async () => {
    makeLookup('93.184.216.34');
    await expect(parseUrl('https://example.com/page')).rejects.toThrow('UNSUPPORTED_SOURCE');
  });
});
