<?php
/**
 * Registers Chatrico settings and renders the "Connect" page.
 *
 * Logged out  → email/password login form.
 * Logged in   → account summary, widget settings (agent + toggles) and a
 *               usage snapshot, with upgrade prompts.
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

function chatrico_register_settings() {
	register_setting( 'chatrico_settings', 'chatrico_site_url', array(
		'type'              => 'string',
		'sanitize_callback' => 'esc_url_raw',
		'default'           => CHATRICO_DEFAULT_SITE,
	) );
	register_setting( 'chatrico_settings', 'chatrico_agent_id', array(
		'type'              => 'string',
		'sanitize_callback' => 'sanitize_text_field',
		'default'           => '',
	) );
	register_setting( 'chatrico_settings', 'chatrico_enable_widget', array(
		'type'              => 'string',
		'sanitize_callback' => 'chatrico_sanitize_checkbox',
		'default'           => '1',
	) );
	register_setting( 'chatrico_settings', 'chatrico_hide_for_admins', array(
		'type'              => 'string',
		'sanitize_callback' => 'chatrico_sanitize_checkbox',
		'default'           => '0',
	) );
}
add_action( 'admin_init', 'chatrico_register_settings' );

function chatrico_sanitize_checkbox( $value ) {
	return ( '1' === $value || 1 === $value || 'on' === $value || true === $value ) ? '1' : '0';
}

/**
 * Render the Connect / Settings screen.
 */
function chatrico_render_settings_page() {
	if ( ! current_user_can( 'manage_options' ) ) {
		return;
	}

	echo '<div class="wrap chatrico-wrap">';
	echo '<h1 class="chatrico-title"><span class="chatrico-logo">🤖</span> Chatrico</h1>';

	if ( ! chatrico_is_logged_in() ) {
		chatrico_render_login_form();
		echo '</div>';
		return;
	}

	// Logged in.
	chatrico_upgrade_banner();
	chatrico_render_account_card();
	chatrico_render_widget_settings();

	echo '</div>';
}

/**
 * Login form (logged-out state).
 */
function chatrico_render_login_form() {
	$err = get_transient( 'chatrico_login_error' );
	if ( $err ) {
		delete_transient( 'chatrico_login_error' );
		echo '<div class="notice notice-error chatrico-notice"><p>' . esc_html( $err ) . '</p></div>';
	}
	$signup_url = chatrico_site_url();
	?>
	<div class="chatrico-card chatrico-login">
		<h2>Log in to Chatrico</h2>
		<p class="chatrico-sub">Connect this site to your Chatrico account to manage your agent, read your inbox and track usage — right here in WordPress.</p>

		<form method="post" action="<?php echo esc_url( admin_url( 'admin-post.php' ) ); ?>">
			<input type="hidden" name="action" value="chatrico_login" />
			<?php wp_nonce_field( 'chatrico_login' ); ?>
			<table class="form-table" role="presentation">
				<tr>
					<th scope="row"><label for="chatrico_email">Email</label></th>
					<td><input name="chatrico_email" id="chatrico_email" type="email" class="regular-text" required autocomplete="username" /></td>
				</tr>
				<tr>
					<th scope="row"><label for="chatrico_password">Password</label></th>
					<td><input name="chatrico_password" id="chatrico_password" type="password" class="regular-text" required autocomplete="current-password" /></td>
				</tr>
			</table>
			<p>
				<button type="submit" class="button button-primary button-hero">Log in</button>
			</p>
		</form>

		<p class="chatrico-sub">
			Don’t have an account? <a href="<?php echo esc_url( $signup_url ); ?>" target="_blank" rel="noopener">Create one free at chatrico.com ↗</a>
			(no credit card required).
		</p>
	</div>
	<?php
}

/**
 * Account summary + logout (logged-in state).
 */
function chatrico_render_account_card() {
	$account = chatrico_account();
	$name    = ! empty( $account['name'] ) ? $account['name'] : ( ! empty( $account['email'] ) ? $account['email'] : 'Your account' );
	$email   = ! empty( $account['email'] ) ? $account['email'] : '';
	$plan    = chatrico_current_plan();
	?>
	<div class="chatrico-card chatrico-account-card">
		<div class="chatrico-account-info">
			<div class="chatrico-avatar">🤖</div>
			<div>
				<p class="chatrico-account-name"><?php echo esc_html( $name ); ?></p>
				<?php if ( $email ) : ?><p class="chatrico-sub"><?php echo esc_html( $email ); ?></p><?php endif; ?>
			</div>
			<span class="chatrico-plan-badge chatrico-plan-<?php echo esc_attr( $plan ); ?>"><?php echo esc_html( chatrico_plan_name( $plan ) ); ?> plan</span>
		</div>
		<form method="post" action="<?php echo esc_url( admin_url( 'admin-post.php' ) ); ?>">
			<input type="hidden" name="action" value="chatrico_logout" />
			<?php wp_nonce_field( 'chatrico_logout' ); ?>
			<button type="submit" class="button">Log out</button>
		</form>
	</div>
	<?php
}

/**
 * Widget settings: pick the agent and toggle the front-end widget.
 */
function chatrico_render_widget_settings() {
	$me      = chatrico_api_me();
	$agents  = ( is_array( $me ) && ! empty( $me['agents'] ) ) ? $me['agents'] : array();
	$current = chatrico_agent_id();
	?>
	<form method="post" action="options.php" class="chatrico-card">
		<?php settings_fields( 'chatrico_settings' ); ?>
		<h2>Chat widget</h2>

		<table class="form-table" role="presentation">
			<tr>
				<th scope="row"><label for="chatrico_agent_id">Agent on this site</label></th>
				<td>
					<?php if ( ! empty( $agents ) ) : ?>
						<select name="chatrico_agent_id" id="chatrico_agent_id">
							<?php foreach ( $agents as $a ) : ?>
								<option value="<?php echo esc_attr( $a['id'] ); ?>" <?php selected( (string) $a['id'], $current ); ?>>
									<?php echo esc_html( $a['name'] ); ?><?php echo empty( $a['isActive'] ) ? ' (inactive)' : ''; ?>
								</option>
							<?php endforeach; ?>
						</select>
						<p class="description">Choose which AI agent shows on your WordPress site.</p>
					<?php else : ?>
						<input name="chatrico_agent_id" id="chatrico_agent_id" type="text" class="regular-text" value="<?php echo esc_attr( $current ); ?>" placeholder="e.g. 12" />
						<p class="description">No agents found yet. <a href="<?php echo esc_url( chatrico_app_url( '/agents' ) ); ?>" target="_blank" rel="noopener">Create one on Chatrico ↗</a>.</p>
					<?php endif; ?>
				</td>
			</tr>
			<tr>
				<th scope="row">Show widget</th>
				<td>
					<label><input type="checkbox" name="chatrico_enable_widget" value="1" <?php checked( '1', get_option( 'chatrico_enable_widget', '1' ) ); ?> /> Load the chat widget on the front end</label>
					<p class="description">Color, position, size and theme are managed in Agent Settings and apply automatically.</p>
				</td>
			</tr>
			<tr>
				<th scope="row">Hide for admins</th>
				<td>
					<label><input type="checkbox" name="chatrico_hide_for_admins" value="1" <?php checked( '1', get_option( 'chatrico_hide_for_admins', '0' ) ); ?> /> Don’t show the widget to logged-in administrators</label>
				</td>
			</tr>
			<tr>
				<th scope="row"><label for="chatrico_site_url">Chatrico URL</label></th>
				<td>
					<input name="chatrico_site_url" id="chatrico_site_url" type="url" class="regular-text" value="<?php echo esc_attr( chatrico_site_url() ); ?>" />
					<p class="description">Leave as <code><?php echo esc_html( CHATRICO_DEFAULT_SITE ); ?></code> unless you self-host.</p>
				</td>
			</tr>
		</table>

		<?php submit_button( 'Save changes' ); ?>
	</form>
	<?php
}
