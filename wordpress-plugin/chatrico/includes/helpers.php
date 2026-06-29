<?php
/**
 * Small shared helpers for reading Chatrico settings and building URLs.
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * The configured Chatrico platform base URL, without a trailing slash.
 *
 * @return string e.g. "https://chatrico.com"
 */
function chatrico_site_url() {
	$url = get_option( 'chatrico_site_url', CHATRICO_DEFAULT_SITE );
	$url = trim( (string) $url );
	if ( '' === $url ) {
		$url = CHATRICO_DEFAULT_SITE;
	}
	return untrailingslashit( $url );
}

/**
 * The configured Agent ID, or '' when not connected yet.
 *
 * @return string
 */
function chatrico_agent_id() {
	return trim( (string) get_option( 'chatrico_agent_id', '' ) );
}

/**
 * Whether the plugin has the minimum config needed to work.
 *
 * @return bool
 */
function chatrico_is_connected() {
	return '' !== chatrico_agent_id();
}

/**
 * Build an absolute URL into the Chatrico app, optionally in embed mode.
 *
 * @param string $path        Path beginning with "/", e.g. "/analytics".
 * @param bool   $embed       Append ?embed=1 to hide the app sidebar (for iframes).
 * @return string
 */
function chatrico_app_url( $path, $embed = false ) {
	$url = chatrico_site_url() . $path;
	if ( $embed ) {
		$url = add_query_arg( 'embed', '1', $url );
	}
	return $url;
}
