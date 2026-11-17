// RFC 9116 security contact. Served as a route handler rather than a static
// file in public/ so the content type and Expires field are explicit.
const CONTACT = 'basnayakavermigrow@gmail.com'
const EXPIRES = '2027-11-17T00:00:00.000Z'

const body = [
  `Contact: mailto:${CONTACT}`,
  `Expires: ${EXPIRES}`,
  'Preferred-Languages: en, si',
  'Canonical: https://www.basnayakavermigrow.lk/.well-known/security.txt',
  '',
].join('\n')

export function GET() {
  return new Response(body, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=86400',
    },
  })
}
