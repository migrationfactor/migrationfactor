<?php
/**
 * Minimal, read-only exposure of Rank Math post meta to the REST API.
 * Add as a Code Snippet / mu-plugin on WordPress. It registers fields only; it never changes content or SEO settings.
 * Then fetch with an Application Password (Users > Profile) and `context=edit`.
 */
add_action( 'rest_api_init', function () {
	$fields = array(
		'rank_math_title', 'rank_math_description', 'rank_math_focus_keyword', 'rank_math_canonical_url',
		'rank_math_robots', 'rank_math_advanced_robots', 'rank_math_facebook_title', 'rank_math_facebook_description',
		'rank_math_facebook_image', 'rank_math_twitter_title', 'rank_math_twitter_description', 'rank_math_twitter_image',
		'rank_math_twitter_use_facebook', 'rank_math_primary_category', 'rank_math_pillar_content', 'rank_math_schema_BlogPosting',
	);
	foreach ( $fields as $key ) {
		register_post_meta( 'post', $key, array(
			'show_in_rest'  => true,
			'single'        => true,
			'type'          => 'string',
			'auth_callback' => function () { return current_user_can( 'edit_posts' ); },
		) );
	}
} );
