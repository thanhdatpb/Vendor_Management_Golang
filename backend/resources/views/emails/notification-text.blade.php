{{ mb_strtoupper($title) }}

{{ $body }}

@foreach ($meta as $metaLabel => $metaValue)
{{ str_pad($metaLabel, 12) }}: {{ $metaValue }}
@endforeach

{{ $buttonLabel }}: {{ $buttonUrl }}

HappyC-VendorHub - vendorhub.viehana.com
