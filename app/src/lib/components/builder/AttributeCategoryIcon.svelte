<script lang="ts">
	interface Props {
		categoryId: string;
		class?: string;
	}

	let { categoryId, class: className = '' }: Props = $props();

	const icons: Record<string, string> = {
		body: 'fa-solid fa-dumbbell',
		adroit: 'fa-solid fa-bolt',
		mind: 'fa-solid fa-brain'
	};
</script>

<i class="{icons[categoryId] ?? icons.body} {className}" aria-hidden="true"></i>
