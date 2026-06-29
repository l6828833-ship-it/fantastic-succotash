<?php
/**
 * Shared UI: pricing data, the upgrade banner, plan badge and usage meters.
 * These are reused on every plugin page so upgrade prompts appear everywhere.
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Pricing plans (kept in sync with chatrico.com).
 *
 * @return array
 */
function chatrico_plans() {
	return array(
		array(
			'id'        => 'free',
			'name'      => 'Free',
			'price'     => '$0',
			'period'    => '',
			'highlight' => false,
			'features'  => array( '1 AI agent', '50 AI conversations / mo', '30 contacts', '30 tickets / mo', 'Basic analytics' ),
		),
		array(
			'id'        => 'starter',
			'name'      => 'Starter',
			'price'     => '$9.99',
			'period'    => '/mo',
			'highlight' => false,
			'features'  => array( '2 AI agents', '1,000 AI conversations / mo', '1,000 contacts', 'Human handoff & live inbox', 'Remove branding' ),
		),
		array(
			'id'        => 'pro',
			'name'      => 'Pro',
			'price'     => '$49',
			'period'    => '/mo',
			'highlight' => true,
			'features'  => array( '5 AI agents', '6,000 AI conversations / mo', '5,000 contacts', 'Email branding + CSV export', 'Advanced analytics', '10 team seats' ),
		),
		array(
			'id'        => 'business',
			'name'      => 'Business',
			'price'     => '$129',
			'period'    => '/mo',
			'highlight' => false,
			'features'  => array( '15 AI agents', '20,000 AI conversations / mo', '25,000 contacts', '25 team seats', 'Priority support + onboarding' ),
		),
	);
}

/**
 * Human-friendly plan name.
 *
 * @param string $plan Plan id.
 * @return string
 */
function chatrico_plan_name( $plan ) {
	$names = array(
		'free'       => 'Free',
		'starter'    => 'Starter',
		'pro'        => 'Pro',
		'business'   => 'Business',
		'enterprise' => 'Enterprise',
	);
	$plan = strtolower( (string) $plan );
	return isset( $names[ $plan ] ) ? $names[ $plan ] : ucfirst( $plan );
}

/**
 * Deep link that opens the Chatrico checkout for a plan.
 *
 * @param string $plan Plan id.
 * @return string
 */
function chatrico_upgrade_url( $plan ) {
	return chatrico_app_url( '/settings?upgrade=' . rawurlencode( $plan ) );
}

/**
 * The current plan from the cached snapshot ('free' when unknown).
 *
 * @return string
 */
function chatrico_current_plan() {
	$me = chatrico_api_me();
	return ( is_array( $me ) && ! empty( $me['plan'] ) ) ? strtolower( $me['plan'] ) : 'free';
}

/**
 * The next plan up from the current one, or '' when already at the top.
 *
 * @return string
 */
function chatrico_next_plan() {
	$order = array( 'free', 'starter', 'pro', 'business' );
	$idx   = array_search( chatrico_current_plan(), $order, true );
	if ( false === $idx || $idx >= count( $order ) - 1 ) {
		return '';
	}
	return $order[ $idx + 1 ];
}

/**
 * The persistent "upgrade" banner shown at the top of every plugin page
 * (hidden only on the top-tier plans).
 */
function chatrico_upgrade_banner() {
	$plan = chatrico_current_plan();
	if ( in_array( $plan, array( 'business', 'enterprise' ), true ) ) {
		return;
	}
	$next      = chatrico_next_plan();
	$next_name = $next ? chatrico_plan_name( $next ) : 'Pro';
	$next      = $next ? $next : 'pro';
	$plans_url = admin_url( 'admin.php?page=chatrico-plans' );
	?>
	<div class="chatrico-upgrade-banner">
		<div class="chatrico-ub-text">
			<strong>You’re on the <?php echo esc_html( chatrico_plan_name( $plan ) ); ?> plan.</strong>
			Upgrade to <strong><?php echo esc_html( $next_name ); ?></strong> for more AI conversations, more agents and premium features.
		</div>
		<div class="chatrico-ub-actions">
			<a class="button button-primary" href="<?php echo esc_url( chatrico_upgrade_url( $next ) ); ?>" target="_blank" rel="noopener">Upgrade now ↗</a>
			<a class="button" href="<?php echo esc_url( $plans_url ); ?>">Compare plans</a>
		</div>
	</div>
	<?php
}

/**
 * Render a single usage meter (used / limit) with a progress bar.
 *
 * @param string   $label Metric label.
 * @param int      $used  Amount used.
 * @param int|null $limit Limit, or null for unlimited.
 */
function chatrico_usage_meter( $label, $used, $limit ) {
	$used      = (int) $used;
	$unlimited = ( null === $limit );
	$limit_txt = $unlimited ? 'Unlimited' : number_format_i18n( (int) $limit );
	$pct       = ( ! $unlimited && $limit > 0 ) ? min( 100, round( ( $used / $limit ) * 100 ) ) : 0;
	$near      = ( $pct >= 80 );
	?>
	<div class="chatrico-meter">
		<div class="chatrico-meter-head">
			<span class="chatrico-meter-label"><?php echo esc_html( $label ); ?></span>
			<span class="chatrico-meter-num"><?php echo esc_html( number_format_i18n( $used ) ); ?> / <?php echo esc_html( $limit_txt ); ?></span>
		</div>
		<div class="chatrico-meter-track">
			<div class="chatrico-meter-fill<?php echo $near ? ' is-near' : ''; ?>" style="width: <?php echo esc_attr( $unlimited ? 6 : $pct ); ?>%;"></div>
		</div>
	</div>
	<?php
}

/**
 * Render the pricing cards grid (used on the Plans page and Usage board).
 * Styles are inlined once so the design always renders, even if the admin
 * stylesheet is cached or unavailable.
 *
 * @param string $current Current plan id (to mark the active card).
 */
function chatrico_render_plans_grid( $current ) {
	$current = strtolower( (string) $current );

	// Print the scoped CSS only once per request.
	static $printed_css = false;
	if ( ! $printed_css ) {
		$printed_css = true;
		?>
		<style>
		.crico-plans{display:grid;grid-template-columns:repeat(4,1fr);gap:16px;margin-top:8px}
		@media(max-width:1200px){.crico-plans{grid-template-columns:repeat(2,1fr)}}
		@media(max-width:680px){.crico-plans{grid-template-columns:1fr}}
		.crico-plan{position:relative;display:flex;flex-direction:column;background:#fff;border:1px solid #e2e4e9;border-radius:16px;padding:22px 20px 20px;transition:transform .15s ease,box-shadow .15s ease}
		.crico-plan:hover{transform:translateY(-3px);box-shadow:0 12px 28px rgba(17,24,39,.10)}
		.crico-plan.is-pop{border-color:#6366f1;box-shadow:0 14px 34px rgba(99,102,241,.20)}
		.crico-plan.is-cur{border-color:#10b981}
		.crico-pop-tag{position:absolute;top:-12px;left:50%;transform:translateX(-50%);background:linear-gradient(90deg,#6366f1,#8b5cf6);color:#fff;font-size:11px;font-weight:700;letter-spacing:.3px;padding:4px 12px;border-radius:999px;white-space:nowrap;box-shadow:0 4px 10px rgba(99,102,241,.35)}
		.crico-cur-tag{position:absolute;top:-12px;left:50%;transform:translateX(-50%);background:#10b981;color:#fff;font-size:11px;font-weight:700;padding:4px 12px;border-radius:999px}
		.crico-plan h3{margin:4px 0 0;font-size:17px;font-weight:700;color:#111827}
		.crico-price{display:flex;align-items:baseline;gap:3px;margin:10px 0 4px}
		.crico-price b{font-size:34px;font-weight:800;color:#111827;line-height:1}
		.crico-price span{font-size:13px;color:#6b7280;font-weight:500}
		.crico-feats{list-style:none;margin:14px 0 18px;padding:0;flex:1;display:flex;flex-direction:column;gap:9px}
		.crico-feats li{position:relative;padding-left:25px;font-size:13px;color:#374151;line-height:1.4}
		.crico-feats li::before{content:"";position:absolute;left:0;top:1px;width:16px;height:16px;border-radius:999px;background:#ecfdf5}
		.crico-feats li::after{content:"✓";position:absolute;left:4px;top:0;font-size:11px;font-weight:800;color:#059669}
		.crico-cta{display:block;text-align:center;text-decoration:none;font-weight:600;font-size:14px;padding:11px 14px;border-radius:10px;transition:opacity .15s ease}
		.crico-cta-up{background:linear-gradient(90deg,#6366f1,#8b5cf6);color:#fff!important;box-shadow:0 6px 16px rgba(99,102,241,.30)}
		.crico-cta-up:hover{opacity:.92}
		.crico-cta-cur{background:#f3f4f6;color:#6b7280!important;cursor:default}
		.crico-cta-free{background:#fff;color:#6b7280!important;border:1px solid #e2e4e9}
		</style>
		<?php
	}
	?>
	<div class="crico-plans">
		<?php foreach ( chatrico_plans() as $p ) : ?>
			<?php
			$is_current = ( $p['id'] === $current );
			$classes    = 'crico-plan';
			if ( $p['highlight'] ) {
				$classes .= ' is-pop';
			}
			if ( $is_current ) {
				$classes .= ' is-cur';
			}
			?>
			<div class="<?php echo esc_attr( $classes ); ?>">
				<?php if ( $is_current ) : ?>
					<span class="crico-cur-tag">Your plan</span>
				<?php elseif ( $p['highlight'] ) : ?>
					<span class="crico-pop-tag">★ Most popular</span>
				<?php endif; ?>
				<h3><?php echo esc_html( $p['name'] ); ?></h3>
				<div class="crico-price"><b><?php echo esc_html( $p['price'] ); ?></b><span><?php echo esc_html( $p['period'] ); ?></span></div>
				<ul class="crico-feats">
					<?php foreach ( $p['features'] as $f ) : ?>
						<li><?php echo esc_html( $f ); ?></li>
					<?php endforeach; ?>
				</ul>
				<?php if ( $is_current ) : ?>
					<span class="crico-cta crico-cta-cur">Current plan</span>
				<?php elseif ( 'free' === $p['id'] ) : ?>
					<span class="crico-cta crico-cta-free">Free forever</span>
				<?php else : ?>
					<a class="crico-cta crico-cta-up" href="<?php echo esc_url( chatrico_upgrade_url( $p['id'] ) ); ?>" target="_blank" rel="noopener">Upgrade to <?php echo esc_html( $p['name'] ); ?> ↗</a>
				<?php endif; ?>
			</div>
		<?php endforeach; ?>
	</div>
	<?php
}
