<?php
/**
 * Talks to the Chatrico REST API (/api/plugin/*) and stores the login session.
 *
 * Login returns a long-lived bearer token; we keep it in wp_options and use it
 * to fetch the account snapshot (plan, usage, agents) from /api/plugin/me,
 * cached briefly in a transient so pages stay fast.
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

function chatrico_api_base() {
	return chatrico_site_url() . '/api';
}

function chatrico_token() {
	return (string) get_option( 'chatrico_token', '' );
}

function chatrico_is_logged_in() {
	return '' !== chatrico_token();
}

/**
 * Stored {name,email} for the logged-in Chatrico account.
 *
 * @return array
 */
function chatrico_account() {
	$a = get_option( 'chatrico_account', array() );
	return is_array( $a ) ? $a : array();
}

/**
 * Cache the account snapshot returned by login / me.
 *
 * @param array $data Snapshot with account/plan/usage/agents.
 */
function chatrico_cache_me( $data ) {
	if ( isset( $data['account'] ) && is_array( $data['account'] ) ) {
		update_option( 'chatrico_account', $data['account'] );
	}
	set_transient( 'chatrico_me', $data, 60 );
}

/**
 * Forget the session.
 */
function chatrico_clear_session() {
	delete_option( 'chatrico_token' );
	delete_option( 'chatrico_account' );
	delete_transient( 'chatrico_me' );
}

/**
 * POST /api/plugin/login.
 *
 * @param string $email    Account email.
 * @param string $password Account password.
 * @return array|WP_Error  Snapshot on success.
 */
function chatrico_api_login( $email, $password ) {
	$resp = wp_remote_post(
		chatrico_api_base() . '/plugin/login',
		array(
			'timeout' => 20,
			'headers' => array( 'Content-Type' => 'application/json' ),
			'body'    => wp_json_encode( array( 'email' => $email, 'password' => $password ) ),
		)
	);

	if ( is_wp_error( $resp ) ) {
		return new WP_Error( 'chatrico_net', 'Could not reach Chatrico. Check the Chatrico URL and try again.' );
	}

	$code = (int) wp_remote_retrieve_response_code( $resp );
	$data = json_decode( wp_remote_retrieve_body( $resp ), true );

	if ( 200 !== $code || empty( $data['token'] ) ) {
		$msg = ( is_array( $data ) && ! empty( $data['error'] ) ) ? $data['error'] : 'Login failed. Check your email and password.';
		return new WP_Error( 'chatrico_login', $msg );
	}

	update_option( 'chatrico_token', $data['token'] );
	chatrico_cache_me( $data );
	return $data;
}

/**
 * GET /api/plugin/me (cached ~60s). Returns null when logged out / on error.
 *
 * @param bool $force Skip the cache.
 * @return array|null
 */
function chatrico_api_me( $force = false ) {
	if ( ! chatrico_is_logged_in() ) {
		return null;
	}

	if ( ! $force ) {
		$cached = get_transient( 'chatrico_me' );
		if ( false !== $cached ) {
			return $cached;
		}
	}

	$resp = wp_remote_get(
		chatrico_api_base() . '/plugin/me',
		array(
			'timeout' => 20,
			'headers' => array( 'Authorization' => 'Bearer ' . chatrico_token() ),
		)
	);

	if ( is_wp_error( $resp ) ) {
		$cached = get_transient( 'chatrico_me' );
		return ( false !== $cached ) ? $cached : null;
	}

	$code = (int) wp_remote_retrieve_response_code( $resp );
	if ( 401 === $code ) {
		// Token no longer valid — clear it so the user logs in again.
		chatrico_clear_session();
		return null;
	}

	$data = json_decode( wp_remote_retrieve_body( $resp ), true );
	if ( 200 !== $code || ! is_array( $data ) ) {
		$cached = get_transient( 'chatrico_me' );
		return ( false !== $cached ) ? $cached : null;
	}

	chatrico_cache_me( $data );
	return $data;
}

/* ─── Form handlers (admin-post.php) ─────────────────────────────────────── */

add_action( 'admin_post_chatrico_login', 'chatrico_handle_login' );
function chatrico_handle_login() {
	if ( ! current_user_can( 'manage_options' ) ) {
		wp_die( 'Not allowed' );
	}
	check_admin_referer( 'chatrico_login' );

	$email    = isset( $_POST['chatrico_email'] ) ? sanitize_email( wp_unslash( $_POST['chatrico_email'] ) ) : '';
	// Passwords must be sent to the Chatrico API verbatim; sanitizing would
	// corrupt valid passwords (e.g. those containing "<" or spaces). It is sent
	// over HTTPS and never stored or output, and the request is nonce-protected.
	$password = isset( $_POST['chatrico_password'] ) ? (string) wp_unslash( $_POST['chatrico_password'] ) : ''; // phpcs:ignore WordPress.Security.ValidatedSanitizedInput.InputNotSanitized

	$res = chatrico_api_login( $email, $password );

	if ( is_wp_error( $res ) ) {
		set_transient( 'chatrico_login_error', $res->get_error_message(), 30 );
	} else {
		// If no widget agent is chosen yet, default to the first one.
		if ( '' === chatrico_agent_id() && ! empty( $res['agents'][0]['id'] ) ) {
			update_option( 'chatrico_agent_id', (string) $res['agents'][0]['id'] );
		}
	}

	wp_safe_redirect( admin_url( 'admin.php?page=chatrico' ) );
	exit;
}

add_action( 'admin_post_chatrico_logout', 'chatrico_handle_logout' );
function chatrico_handle_logout() {
	if ( ! current_user_can( 'manage_options' ) ) {
		wp_die( 'Not allowed' );
	}
	check_admin_referer( 'chatrico_logout' );
	chatrico_clear_session();
	wp_safe_redirect( admin_url( 'admin.php?page=chatrico' ) );
	exit;
}

add_action( 'admin_post_chatrico_dismiss_banner', 'chatrico_dismiss_banner' );
function chatrico_dismiss_banner() {
	if ( ! current_user_can( 'manage_options' ) ) {
		wp_die( 'Not allowed' );
	}
	check_admin_referer( 'chatrico_dismiss_banner' );
	update_user_meta( get_current_user_id(), 'chatrico_banner_dismissed', time() );
	$back = wp_get_referer();
	wp_safe_redirect( $back ? $back : admin_url( 'admin.php?page=chatrico' ) );
	exit;
}
