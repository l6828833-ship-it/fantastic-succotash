<?php
/**
 * Registers Chatrico settings and renders the "Connect" page.
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Register settings with WordPress (sanitized on save).
 */
function chatrico_register_settings() {
	register_setting(
		'chatrico_settings',
		'chatrico_site_url',
		array(
			'type'              => 'string',
			'sanitize_callback' => 'esc_url_raw',
			'default'           => CHATRICO_DEFAULT_SITE,
		)
	);
	register_setting(
		'chatrico_settings',
		'chatrico_agent_id',
		array(
			'type'              => 'string',
			'sanitize_callback' => 'sanitize_text_field',
			'default'           => '',
		)
	);
	register_setting(
		'chatrico_settings',
		'chatrico_enable_widget',
		array(
			'type'              => 'string',
			'sanitize_callback' => 'chatrico_sanitize_checkbox',
			'default'           => '1',
		)
	);
	register_setting(
		'chatrico_settings',
		'chatrico_hide_for_admins',
		array(
			'type'              => 'string',
			'sanitize_callback' => 'chatrico_sanitize_checkbox',
			'default'           => '0',
		)
	);
}
add_action( 'admin_init', 'chatrico_register_settings' );

/**
 * Normalize a checkbox value to '1' or '0'.
 *
 * @param mixed $value Raw value.
 * @return string
 */
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

	$connected = chatrico_is_connected();
	$embed_url = chatrico_app_url( '/embed' );
	?>
	<div class="wrap chatrico-wrap">
		<h1 class="chatrico-title">
			<span class="chatrico-logo">🤖</span> Chatrico
		</h1>

		<?php if ( ! $connected ) : ?>
			<div class="notice notice-info chatrico-notice">
				<p><strong>Almost there!</strong> Paste your <strong>Agent ID</strong> below to connect this site.
				You can find it in your Chatrico dashboard under
				<a href="<?php echo esc_url( $embed_url ); ?>" target="_blank" rel="noopener">Embed Code ↗</a>.</p>
			</div>
		<?php else : ?>
			<div class="notice notice-success chatrico-notice">
				<p><strong>Connected.</strong> Your chat widget is set to load on your site’s front end.</p>
			</div>
		<?php endif; ?>

		<form method="post" action="options.php" class="chatrico-card">
			<?php settings_fields( 'chatrico_settings' ); ?>

			<h2>Connection</h2>

			<table class="form-table" role="presentation">
				<tr>
					<th scope="row"><label for="chatrico_agent_id">Agent ID</label></th>
					<td>
						<input
							name="chatrico_agent_id"
							id="chatrico_agent_id"
							type="text"
							class="regular-text"
							value="<?php echo esc_attr( chatrico_agent_id() ); ?>"
							placeholder="e.g. 12"
						/>
						<p class="description">Find this in Chatrico → Embed Code (the <code>agentId</code> value).</p>
					</td>
				</tr>
				<tr>
					<th scope="row"><label for="chatrico_site_url">Chatrico URL</label></th>
					<td>
						<input
							name="chatrico_site_url"
							id="chatrico_site_url"
							type="url"
							class="regular-text"
							value="<?php echo esc_attr( chatrico_site_url() ); ?>"
							placeholder="<?php echo esc_attr( CHATRICO_DEFAULT_SITE ); ?>"
						/>
						<p class="description">Leave as <code><?php echo esc_html( CHATRICO_DEFAULT_SITE ); ?></code> unless you self-host.</p>
					</td>
				</tr>
			</table>

			<h2>Widget</h2>

			<table class="form-table" role="presentation">
				<tr>
					<th scope="row">Show widget</th>
					<td>
						<label>
							<input type="checkbox" name="chatrico_enable_widget" value="1" <?php checked( '1', get_option( 'chatrico_enable_widget', '1' ) ); ?> />
							Load the chat widget on the front end of my site
						</label>
						<p class="description">Appearance (color, position, size, theme) is controlled in your Agent Settings on Chatrico and applies automatically.</p>
					</td>
				</tr>
				<tr>
					<th scope="row">Hide for admins</th>
					<td>
						<label>
							<input type="checkbox" name="chatrico_hide_for_admins" value="1" <?php checked( '1', get_option( 'chatrico_hide_for_admins', '0' ) ); ?> />
							Don’t show the widget to logged-in administrators
						</label>
						<p class="description">Useful while you’re setting things up.</p>
					</td>
				</tr>
			</table>

			<?php submit_button( 'Save changes' ); ?>
		</form>

		<div class="chatrico-card chatrico-help">
			<h2>How it works</h2>
			<ol>
				<li>Create a free account and an AI agent at <a href="<?php echo esc_url( chatrico_site_url() ); ?>" target="_blank" rel="noopener">chatrico.com</a>.</li>
				<li>Copy your <strong>Agent ID</strong> from Embed Code and paste it above.</li>
				<li>Save — the chat widget appears on your site instantly.</li>
				<li>Use the <strong>Analytics</strong>, <strong>Agent</strong> and <strong>Inbox</strong> tabs here to manage things without leaving WordPress.</li>
			</ol>
		</div>
	</div>
	<?php
}
